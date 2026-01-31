export const CONFIG = {
    token: process.env.DISCORD_TOKEN,
  
    channels: {
      admin: process.env.ADMIN_CHANNEL || 'moltbot-admin',
      options: process.env.OPTIONS_CHANNEL || 'moltbot-options',
      logs: process.env.LOGS_CHANNEL || 'moltbot-logs'
    },
  
    // America/Denver
    timezone: process.env.BOT_TZ || 'America/Denver',
  
    // Schedule defaults
    schedule: {
      daily: process.env.DAILY_CRON || '30 7 * * 1-5',   // 7:30am Mon–Fri
      weekly: process.env.WEEKLY_CRON || '00 9 * * 6'    // 9:00am Saturday
    }
  }
  