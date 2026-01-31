export const CONFIG = {
  token: process.env.DISCORD_TOKEN,

  channels: {
    admin: process.env.ADMIN_CHANNEL || 'mybot-admin',
    options: process.env.OPTIONS_CHANNEL || 'moltbot-options',
    logs: process.env.LOGS_CHANNEL || 'moltbot-logs',
    trends: process.env.TRENDS_CHANNEL || 'trends',
    alerts: process.env.ALERTS_CHANNEL || 'alerts',
    marketOpen: process.env.MARKET_CHANNEL || 'market-open',
    opportunities: process.env.OPPORTUNITIES_CHANNEL || 'opportunities'
  },

  // Channel IDs (for direct posting)
  channelIds: {
    trends: process.env.DISCORD_TRENDS_CHANNEL_ID,
    alerts: process.env.DISCORD_ALERTS_CHANNEL_ID,
    market: process.env.DISCORD_MARKET_CHANNEL_ID,
    opportunities: process.env.DISCORD_OPPORTUNITIES_CHANNEL_ID
  },

  // Timezone
  timezone: process.env.BOT_TZ || 'America/Denver',

  // Schedule defaults
  schedule: {
    daily: process.env.DAILY_CRON || '0 9 * * 1-5',      // 9:00am Mon–Fri
    weekly: process.env.WEEKLY_CRON || '0 9 * * 6',      // 9:00am Saturday
    hourlyTrends: process.env.TRENDS_CRON || '0 * * * *', // Every hour
    marketOpen: process.env.MARKET_OPEN_CRON || '30 9 * * 1-5',  // 9:30am Mon-Fri
    marketClose: process.env.MARKET_CLOSE_CRON || '0 16 * * 1-5' // 4:00pm Mon-Fri
  },

  // External service URLs
  moltbotUrl: process.env.MOLTBOT_SERVICE_URL || 'http://moltbot:8080',
  
  // API Keys
  polygonApiKey: process.env.POLYGON_API_KEY,
  braveApiKey: process.env.BRAVE_SEARCH_API_KEY
}
  