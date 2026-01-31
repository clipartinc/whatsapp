import 'dotenv/config'
import express from 'express'
import { Client, GatewayIntentBits, Events } from 'discord.js'

// ============================================
// Configuration
// ============================================
const CONFIG = {
  token: process.env.DISCORD_TOKEN,
  moltbotUrl: process.env.MOLTBOT_INTERNAL_URL || 'http://moltbot.railway.internal:8080',
  moltbotHooksPath: process.env.MOLTBOT_HOOKS_PATH || '/hooks',
  moltbotHooksToken: process.env.MOLTBOT_HOOKS_TOKEN || '',
  adminChannel: process.env.ADMIN_CHANNEL || 'mybot-admin',
  timezone: process.env.BOT_TZ || 'America/New_York'
}

// ============================================
// Express Server (Health checks & webhooks)
// ============================================
const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000

// Health check
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

// Webhook to post message to Discord channel
app.post('/webhook/post', async (req, res) => {
  try {
    const { channel, channelId, message } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'message required' })
    }

    const guild = client.guilds.cache.first()
    if (!guild) {
      return res.status(503).json({ error: 'Bot not connected to any guild' })
    }

    let ch
    if (channelId) {
      ch = guild.channels.cache.get(channelId)
    } else if (channel) {
      ch = guild.channels.cache.find(c => c?.name === channel)
    }

    if (!ch || !ch.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    await ch.send(message)
    res.json({ success: true, channel: ch.name })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Forward request to moltbot service
app.post('/api/message', async (req, res) => {
  try {
    const response = await fetch(`${CONFIG.moltbotUrl}/api/message`, {
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

// Trigger moltbot to run a task
app.post('/api/trigger/:task', async (req, res) => {
  try {
    const response = await fetch(`${CONFIG.moltbotUrl}/api/trigger/${req.params.task}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Trigger error:', error)
    res.status(502).json({ error: 'Failed to reach moltbot service' })
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
  console.log(`🟢 Discord gateway online as ${c.user.tag}`)
  
  const guild = c.guilds.cache.first()
  if (!guild) {
    console.log('⚠️ No guild found. Invite the bot to a server.')
    return
  }
  
  console.log(`📡 Connected to guild: ${guild.name}`)
})

// Forward messages to moltbot service via hooks API
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return

  const isAdminChannel = message.channel?.name === CONFIG.adminChannel
  
  // Respond in admin channel, when mentioned, or in configured bot channels
  const botMentioned = message.mentions.has(client.user)
  const botChannels = ['mybot-admin', 'trends', 'alerts', 'market-open', 'opportunities']
  const isBotChannel = botChannels.includes(message.channel?.name)
  
  if (!isAdminChannel && !botMentioned && !isBotChannel) return

  // Remove bot mention from content if present
  let content = message.content
  if (botMentioned) {
    content = content.replace(/<@!?\d+>/g, '').trim()
  }

  if (!content) return

  try {
    // Use the hooks/agent endpoint to send message to moltbot
    const hookUrl = `${CONFIG.moltbotUrl}${CONFIG.moltbotHooksPath}/agent`
    
    const headers = { 'Content-Type': 'application/json' }
    if (CONFIG.moltbotHooksToken) {
      headers['Authorization'] = `Bearer ${CONFIG.moltbotHooksToken}`
    }

    const response = await fetch(hookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: content,
        name: message.author.username,
        wakeMode: 'now',
        deliver: true,
        channel: 'discord',
        to: message.channel.id
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('Message forwarded to moltbot:', data)
      // The agent will respond via Discord channel directly
    } else {
      const errorText = await response.text()
      console.error('Moltbot hook error:', response.status, errorText)
      
      if (isAdminChannel) {
        await message.reply(`⚠️ Backend error: ${response.status}`)
      }
    }
  } catch (error) {
    console.error('Failed to forward to moltbot:', error.message)
    
    if (isAdminChannel) {
      await message.reply('⚠️ Backend service temporarily unavailable.')
    }
  }
})

// ============================================
// Start Everything
// ============================================
app.listen(PORT, () => {
  console.log(`🌐 Webhook server running on port ${PORT}`)
})

client.login(CONFIG.token)
