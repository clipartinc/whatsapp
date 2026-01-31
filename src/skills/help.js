export default {
    name: 'help',
    match: async ({ text, isAdminChannel }) => isAdminChannel && text === '!help',
    run: async ({ message }) => {
      await message.reply([
        '**moltbot commands (admin channel):**',
        '`!watchlist add TSLA,NVDA,SPY`',
        '`!watchlist show`',
        '`!scan` (uses watchlist)',
        '`!daily` (post daily report to #moltbot-options)',
        '`!weekly` (post weekly report to #moltbot-options)',
        '`ping` (anywhere) -> pong'
      ].join('\n'))
    }
  }
  