import 'dotenv/config'
import express from 'express'
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { CONFIG } from './src/config.js'
import { routeMessage } from './src/router.js'
import { postToChannel } from './src/lib/discord.js'
import { startScheduler } from './src/scheduler.js'

// Skills
import ping from './src/skills/ping.js'
import help from './src/skills/help.js'
import watchlist from './src/skills/watchlist.js'
import scan from './src/skills/scan.js'
import daily, { buildDailyReport } from './src/skills/daily.js'
import weekly, { buildWeeklyReport } from './src/skills/weekly.js'
import ask from './src/skills/ask.js'
import chat from './src/skills/chat.js'

const skills = [ping, help, watchlist, scan, daily, weekly, ask, chat]

// ============================================
// Express server for Railway health checks & webhooks
// ============================================
const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const MOLTBOT_URL = process.env.MOLTBOT_SERVICE_URL || 'http://moltbot:8080'

// Health check endpoint (required for Railway)
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'discord-webhook',
    bot: client.user?.tag || 'connecting...',
    uptime: process.uptime()
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' })
})

// Webhook endpoint to receive external triggers
app.post('/webhook/post', async (req, res) => {
  try {
    const { channel, message, channelId } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'message required' })
    }

    const guild = client.guilds.cache.first()
    if (!guild) {
      return res.status(503).json({ error: 'Bot not connected to any guild' })
    }

    // Post by channel name or ID
    if (channelId) {
      const ch = guild.channels.cache.get(channelId)
      if (ch) {
        await ch.send(message)
        return res.json({ success: true, channel: ch.name })
      }
    } else if (channel) {
      await postToChannel(guild, channel, message)
      return res.json({ success: true, channel })
    }

    res.status(400).json({ error: 'channel or channelId required' })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint to trigger scheduled reports manually
app.post('/webhook/trigger/:report', async (req, res) => {
  try {
    const { report } = req.params
    const guild = client.guilds.cache.first()
    
    if (!guild) {
      return res.status(503).json({ error: 'Bot not connected' })
    }

    const postOptions = async (txt) => postToChannel(guild, CONFIG.channels.options, txt)

    if (report === 'daily') {
      const content = await buildDailyReport()
      await postOptions(content)
      return res.json({ success: true, report: 'daily' })
    } else if (report === 'weekly') {
      const content = await buildWeeklyReport()
      await postOptions(content)
      return res.json({ success: true, report: 'weekly' })
    }

    res.status(400).json({ error: 'Unknown report type. Use: daily, weekly' })
  } catch (error) {
    console.error('Trigger error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Forward requests to moltbot service
app.post('/webhook/moltbot', async (req, res) => {
  try {
    const response = await fetch(`${MOLTBOT_URL}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Moltbot forward error:', error)
    res.status(502).json({ error: 'Failed to reach moltbot service' })
  }
})

// Endpoint to post to specific channels
app.post('/api/channels/:channelName/messages', async (req, res) => {
  try {
    const { channelName } = req.params
    const { content } = req.body

    const guild = client.guilds.cache.first()
    if (!guild) {
      return res.status(503).json({ error: 'Bot not connected' })
    }

    await postToChannel(guild, channelName, content)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// Discord Bot
// ============================================
if (!CONFIG.token) {
  console.error('❌ DISCORD_TOKEN is missing')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ]
})

client.once(Events.ClientReady, async (c) => {
  console.log(`🟢 moltbot online as ${c.user.tag}`)

  const guild = c.guilds.cache.first()
  if (!guild) {
    console.log('⚠️ No guild found. Invite the bot to a server.')
    return
  }

  const log = async (txt) => postToChannel(guild, CONFIG.channels.logs, txt)
  const postOptions = async (txt) => postToChannel(guild, CONFIG.channels.options, txt)

  // Scheduled jobs
  startScheduler({
    client,
    CONFIG,
    log,
    runDaily: async () => {
      const report = await buildDailyReport()
      await postOptions(report)
      await log('✅ Daily report posted.')
    },
    runWeekly: async () => {
      const report = await buildWeeklyReport()
      await postOptions(report)
      await log('✅ Weekly report posted.')
    }
  })

  await log('🟢 moltbot is online.')
})

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return

  const guild = message.guild
  const isAdminChannel = message.channel?.name === CONFIG.channels.admin

  const log = async (txt) => postToChannel(guild, CONFIG.channels.logs, txt)
  const postOptions = async (txt) => postToChannel(guild, CONFIG.channels.options, txt)

  await routeMessage({
    message,
    skills,
    ctxBase: {
      CONFIG,
      isAdminChannel,
      log,
      postOptions
    }
  })
})

// ============================================
// Start everything
// ============================================
app.listen(PORT, () => {
  console.log(`🌐 Webhook server running on port ${PORT}`)
})

client.login(CONFIG.token)
