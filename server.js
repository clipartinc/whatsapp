import 'dotenv/config'
import express from 'express'
import { Client, GatewayIntentBits, Events } from 'discord.js'

// Catch uncaught errors to prevent crash
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err)
})

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

// Discord client (initialized later)
let client = null
let discordReady = false

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'discord-webhook',
    bot: discordReady ? client?.user?.tag : 'connecting...',
    discordReady,
    uptime: process.uptime()
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', discordReady })
})

// Debug endpoint to test moltbot connection
app.get('/debug/moltbot', async (req, res) => {
  const hookUrl = `${CONFIG.moltbotUrl}${CONFIG.moltbotHooksPath}/agent`
  const results = {
    moltbotUrl: CONFIG.moltbotUrl,
    hooksPath: CONFIG.moltbotHooksPath,
    hookUrl,
    tokenConfigured: !!CONFIG.moltbotHooksToken,
    discordReady
  }
  
  // Test 1: Try to reach the base URL
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(CONFIG.moltbotUrl, { 
      method: 'GET',
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    results.baseUrlTest = {
      status: response.status,
      ok: response.ok
    }
  } catch (error) {
    results.baseUrlTest = { error: error.message, code: error.code }
  }
  
  // Test 2: Try DNS lookup
  try {
    const url = new URL(CONFIG.moltbotUrl)
    const dns = await import('dns').then(m => m.promises)
    const addresses = await dns.lookup(url.hostname)
    results.dnsLookup = { hostname: url.hostname, address: addresses.address }
  } catch (error) {
    results.dnsLookup = { error: error.message }
  }
  
  res.json(results)
})

// Debug endpoint to show config
app.get('/debug/config', (req, res) => {
  res.json({
    discordTokenSet: !!CONFIG.token,
    moltbotUrl: CONFIG.moltbotUrl,
    hooksPath: CONFIG.moltbotHooksPath,
    hooksTokenSet: !!CONFIG.moltbotHooksToken,
    adminChannel: CONFIG.adminChannel,
    discordReady
  })
})

// Webhook to post message to Discord channel
app.post('/webhook/post', async (req, res) => {
  if (!discordReady) {
    return res.status(503).json({ error: 'Discord not ready' })
  }
  
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

// ============================================
// Start Express Server FIRST
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Webhook server running on port ${PORT}`)
  console.log(`🌐 Health check available at http://0.0.0.0:${PORT}/health`)
})

server.on('error', (err) => {
  console.error('❌ Server error:', err)
})

// ============================================
// Discord Bot (starts after Express)
// ============================================
if (!CONFIG.token) {
  console.error('❌ DISCORD_TOKEN is missing - Discord bot will not start')
  console.error('❌ Set DISCORD_TOKEN environment variable')
  // Don't exit - keep Express running for health checks
} else {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.MessageContent
    ]
  })

  client.once(Events.ClientReady, async (c) => {
    discordReady = true
    console.log(`🟢 Discord gateway online as ${c.user.tag}`)
    
    const guild = c.guilds.cache.first()
    if (!guild) {
      console.log('⚠️ No guild found. Invite the bot to a server.')
      return
    }
    
    console.log(`📡 Connected to guild: ${guild.name}`)
  })

  client.on(Events.Error, (error) => {
    console.error('Discord client error:', error)
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
      
      console.log(`📤 Forwarding to: ${hookUrl}`)
      console.log(`📤 Message: ${content.slice(0, 50)}...`)
      
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
        console.log('✅ Message forwarded to moltbot:', data)
      } else {
        const errorText = await response.text()
        console.error('❌ Moltbot hook error:', response.status, errorText)
        
        if (isAdminChannel) {
          await message.reply(`⚠️ Backend error: ${response.status} - ${errorText.slice(0, 100)}`)
        }
      }
    } catch (error) {
      console.error('❌ Failed to forward to moltbot:', error.message)
      
      if (isAdminChannel) {
        await message.reply(`⚠️ Backend unavailable: ${error.message}`)
      }
    }
  })

  client.login(CONFIG.token).catch(err => {
    console.error('❌ Discord login failed:', err.message)
  })
}
