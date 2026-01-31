import 'dotenv/config'
import { Client, GatewayIntentBits, Events } from 'discord.js'

const token = process.env.DISCORD_TOKEN
if (!token) {
  console.error('❌ Missing DISCORD_TOKEN env var')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.once(Events.ClientReady, c => {
  console.log(`🟢 moltbot online as ${c.user.tag}`)
})

client.on(Events.MessageCreate, msg => {
  if (msg.author.bot) return

  if (msg.content?.toLowerCase().trim() === 'ping') {
    msg.reply('pong ✅')
  }
})

client.login(token)
