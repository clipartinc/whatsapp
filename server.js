import 'dotenv/config'
import express from 'express'
import { Client, GatewayIntentBits, Events } from 'discord.js'
import WebSocket from 'ws'
import { randomUUID } from 'crypto'

// Catch uncaught errors
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
  moltbotToken: process.env.MOLTBOT_HOOKS_TOKEN || '',
  adminChannel: process.env.ADMIN_CHANNEL || 'mybot-admin'
}

// Convert HTTP URL to WebSocket URL
function getWsUrl() {
  return CONFIG.moltbotUrl.replace('http://', 'ws://').replace('https://', 'wss://')
}

// ============================================
// Moltbot WebSocket Client
// ============================================
let moltbotWs = null
let moltbotConnected = false
let pendingMessages = new Map()
let reconnectTimer = null

function connectToMoltbot() {
  if (moltbotWs) {
    try { moltbotWs.close() } catch {}
  }
  
  const wsUrl = getWsUrl()
  console.log(`🔌 Connecting to moltbot: ${wsUrl}`)
  
  try {
    moltbotWs = new WebSocket(wsUrl)
    
    moltbotWs.on('open', () => {
      console.log('✅ Connected to moltbot gateway')
      
      // Send connect/hello message
      const connectMsg = {
        jsonrpc: '2.0',
        id: 'connect',
        method: 'connect',
        params: {
          protocol: 1,
          clientName: 'discord-webhook',
          clientVersion: '1.0.0',
          mode: 'node',
          token: CONFIG.moltbotToken || undefined
        }
      }
      moltbotWs.send(JSON.stringify(connectMsg))
    })
    
    moltbotWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        console.log('📨 Moltbot response:', JSON.stringify(msg).slice(0, 200))
        
        // Handle hello/connect response
        if (msg.id === 'connect' && msg.result) {
          moltbotConnected = true
          console.log('✅ Moltbot handshake complete')
        }
        
        // Handle chat responses
        if (msg.id && pendingMessages.has(msg.id)) {
          const { resolve } = pendingMessages.get(msg.id)
          pendingMessages.delete(msg.id)
          resolve(msg.result || msg.error)
        }
        
        // Handle events (agent responses)
        if (msg.method === 'event' && msg.params) {
          handleMoltbotEvent(msg.params)
        }
      } catch (err) {
        console.error('Error parsing moltbot message:', err)
      }
    })
    
    moltbotWs.on('error', (err) => {
      console.error('❌ Moltbot WS error:', err.message)
      moltbotConnected = false
    })
    
    moltbotWs.on('close', (code, reason) => {
      console.log(`🔌 Moltbot connection closed: ${code} - ${reason}`)
      moltbotConnected = false
      
      // Reconnect after delay
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connectToMoltbot()
        }, 5000)
      }
    })
  } catch (err) {
    console.error('❌ Failed to connect to moltbot:', err.message)
    moltbotConnected = false
  }
}

function handleMoltbotEvent(event) {
  // Handle agent text responses
  if (event.type === 'agent.text' && event.text) {
    console.log('🤖 Agent response:', event.text.slice(0, 100))
    // The agent's response - we'd need to track which Discord channel to reply to
  }
}

async function sendToMoltbot(method, params) {
  if (!moltbotWs || moltbotWs.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to moltbot')
  }
  
  const id = randomUUID()
  const msg = {
    jsonrpc: '2.0',
    id,
    method,
    params
  }
  
  return new Promise((resolve, reject) => {
    pendingMessages.set(id, { resolve, reject })
    moltbotWs.send(JSON.stringify(msg))
    
    // Timeout after 30s
    setTimeout(() => {
      if (pendingMessages.has(id)) {
        pendingMessages.delete(id)
        reject(new Error('Timeout waiting for moltbot response'))
      }
    }, 30000)
  })
}

// ============================================
// Express Server
// ============================================
const app = express()
app.use(express.json())
const PORT = process.env.PORT || 3000

let discordClient = null
let discordReady = false

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'discord-webhook',
    discordReady,
    moltbotConnected,
    uptime: process.uptime()
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', discordReady, moltbotConnected })
})

app.get('/debug/moltbot', async (req, res) => {
  // Test TCP connectivity
  let tcpTest = 'not tested'
  try {
    const net = await import('net')
    const url = new URL(CONFIG.moltbotUrl)
    tcpTest = await new Promise((resolve) => {
      const socket = net.createConnection({
        host: url.hostname,
        port: url.port || 8080,
        timeout: 5000
      })
      socket.on('connect', () => {
        socket.destroy()
        resolve('connected')
      })
      socket.on('error', (err) => resolve(`error: ${err.message}`))
      socket.on('timeout', () => {
        socket.destroy()
        resolve('timeout')
      })
    })
  } catch (err) {
    tcpTest = `exception: ${err.message}`
  }
  
  res.json({
    wsUrl: getWsUrl(),
    moltbotConnected,
    tokenConfigured: !!CONFIG.moltbotToken,
    wsState: moltbotWs?.readyState,
    tcpTest
  })
})

app.post('/webhook/post', async (req, res) => {
  if (!discordReady) {
    return res.status(503).json({ error: 'Discord not ready' })
  }
  
  try {
    const { channel, channelId, message } = req.body
    if (!message) {
      return res.status(400).json({ error: 'message required' })
    }
    
    const guild = discordClient.guilds.cache.first()
    if (!guild) {
      return res.status(503).json({ error: 'No guild' })
    }
    
    let ch = channelId 
      ? guild.channels.cache.get(channelId)
      : guild.channels.cache.find(c => c?.name === channel)
    
    if (!ch?.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found' })
    }
    
    await ch.send(message)
    res.json({ success: true, channel: ch.name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// Start Express
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Server running on port ${PORT}`)
  connectToMoltbot()
  startDiscord()
})

// Keep alive
setInterval(() => {
  console.log(`💓 Heartbeat - discord:${discordReady} moltbot:${moltbotConnected}`)
}, 60000)

// ============================================
// Discord Bot
// ============================================
function startDiscord() {
  if (!CONFIG.token) {
    console.error('❌ DISCORD_TOKEN missing')
    return
  }
  
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  })
  
  discordClient.once(Events.ClientReady, (c) => {
    discordReady = true
    console.log(`🟢 Discord online as ${c.user.tag}`)
    const guild = c.guilds.cache.first()
    if (guild) console.log(`📡 Guild: ${guild.name}`)
  })
  
  discordClient.on(Events.Error, (err) => {
    console.error('Discord error:', err)
  })
  
  discordClient.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return
    
    const isAdminChannel = message.channel?.name === CONFIG.adminChannel
    const botMentioned = message.mentions.has(discordClient.user)
    const botChannels = ['mybot-admin', 'trends', 'alerts', 'market-open', 'opportunities']
    const isBotChannel = botChannels.includes(message.channel?.name)
    
    if (!isAdminChannel && !botMentioned && !isBotChannel) return
    
    let content = message.content
    if (botMentioned) {
      content = content.replace(/<@!?\d+>/g, '').trim()
    }
    if (!content) return
    
    console.log(`📤 User message: ${content.slice(0, 50)}...`)
    
    // Check moltbot connection
    if (!moltbotConnected) {
      if (isAdminChannel) {
        await message.reply('⚠️ Backend not connected. Reconnecting...')
      }
      connectToMoltbot()
      return
    }
    
    try {
      // Send chat message to moltbot
      const result = await sendToMoltbot('chat.send', {
        message: content,
        sessionKey: `discord:${message.channel.id}`,
        deliver: false // We'll handle the reply ourselves
      })
      
      console.log('✅ Sent to moltbot:', result)
      
      // If we get an immediate response, reply with it
      if (result?.text) {
        await message.reply(result.text)
      } else if (result?.ok) {
        // Message accepted, agent will process
        await message.react('👀')
      }
    } catch (err) {
      console.error('❌ Moltbot error:', err.message)
      if (isAdminChannel) {
        await message.reply(`⚠️ Error: ${err.message}`)
      }
    }
  })
  
  discordClient.login(CONFIG.token).catch(err => {
    console.error('❌ Discord login failed:', err.message)
  })
}
