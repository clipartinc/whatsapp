import 'dotenv/config'
import { Client, GatewayIntentBits, Events } from 'discord.js'
import { CONFIG } from './config.js'
import { routeMessage } from './router.js'
import { postToChannel } from './lib/discord.js'
import { startScheduler } from './scheduler.js'
import { startDashboard } from './dashboard.js'

// Skills
import ping from './skills/ping.js'
import help from './skills/help.js'
import watchlist from './skills/watchlist.js'
import scan from './skills/scan.js'
import daily, { buildDailyReport } from './skills/daily.js'
import weekly, { buildWeeklyReport } from './skills/weekly.js'
import ask from './skills/ask.js'
import chat from './skills/chat.js'

// Chat skill goes LAST - it's the catch-all for natural language
const skills = [ping, help, watchlist, scan, daily, weekly, ask, chat]

if (!CONFIG.token) {
  console.error('❌ DISCORD_TOKEN is missing')
  process.exit(1)
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
})

client.once(Events.ClientReady, async (c) => {
  console.log(`🟢 moltbot online as ${c.user.tag}`)

  // Start scheduler once bot is ready and guild cache is populated
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

client.login(CONFIG.token)

// Start the web dashboard
startDashboard()
