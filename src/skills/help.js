export default {
  name: 'help',
  match: async ({ text, isAdminChannel }) => isAdminChannel && text === '!help',
  run: async ({ message }) => {
    await message.reply([
      '**moltbot commands (admin channel):**',
      '',
      '📌 **Watchlist**',
      '`!watchlist` - show current watchlist',
      '`!watchlist add TSLA,NVDA` - add tickers',
      '`!watchlist remove TSLA` - remove tickers',
      '`!watchlist auto [N]` - auto-build top N from 40+ stocks',
      '`!watchlist universe` - show scannable stocks',
      '',
      '🔎 **Scanning**',
      '`!scan` - quick scan (top 5)',
      '`!daily` - post daily report to #moltbot-options',
      '`!weekly` - post weekly report to #moltbot-options',
      '',
      '🏓 **Other**',
      '`ping` - check bot is alive'
    ].join('\n'))
  }
}
