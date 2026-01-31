import 'dotenv/config'
import { Client, GatewayIntentBits, Events } from 'discord.js'

const token = process.env.DISCORD_TOKEN
if (!token) { console.error('Missing DISCORD_TOKEN'); process.exit(1) }

const ADMIN_CHANNEL = process.env.ADMIN_CHANNEL || 'mybot-admin'
const LOGS_CHANNEL  = process.env.LOGS_CHANNEL  || 'mybot-logs'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
})

async function logToDiscord(guild, text) {
  const ch = guild.channels.cache.find(c => c.name === LOGS_CHANNEL)
  if (ch && ch.isTextBased()) ch.send(text).catch(() => {})
}

client.once(Events.ClientReady, c => {
  console.log(`🟢 mybot online as ${c.user.tag}`)
})

client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return

  // quick smoke test anywhere
  if (msg.content?.toLowerCase().trim() === 'ping') return msg.reply('pong ✅')

  // only do “work” in admin channel
  if (msg.channel?.name !== ADMIN_CHANNEL) return

  const text = msg.content.trim()

  // Simple starter commands (message-based)
  if (text.startsWith('!note ')) {
    const note = text.slice('!note '.length).trim()
    await logToDiscord(msg.guild, `📝 Note added by <@${msg.author.id}>: ${note}`)
    return msg.reply('Saved ✅')
  }

  if (text.startsWith('!todo ')) {
    const item = text.slice('!todo '.length).trim()
    await logToDiscord(msg.guild, `✅ TODO created by <@${msg.author.id}>: ${item}`)
    return msg.reply(`Added to TODOs ✅: ${item}`)
  }

  if (text === '!help') {
    return msg.reply([
      '**mybot commands (admin channel only):**',
      '`!note <text>` — save a note (logs it)',
      '`!todo <text>` — add a todo (logs it)',
      '`!help` — show this help'
    ].join('\n'))
  }
})

client.login(token)
