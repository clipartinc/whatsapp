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
      '`!watchlist auto [N]` - auto-build top N from 50+ stocks',
      '`!watchlist universe` - show scannable stocks',
      '',
      '🔎 **Scanning**',
      '`!scan` - quick scan (top 5)',
      '`!daily` - post daily report to #moltbot-options',
      '`!weekly` - post weekly report to #moltbot-options',
      '',
      '🤖 **AI Features**',
      '`!ask <question>` - ask AI about trading',
      '`!analyze TICKER` - AI analysis with news',
      '`!news [TICKER]` - get news (ticker or watchlist)',
      '',
      '🏓 **Other**',
      '`ping` - check bot is alive',
      '',
      '💬 **Natural Language**',
      'Just type normally - no ! needed:',
      '"Find puts to sell on SPY"',
      '"What\'s the news on TSLA?"',
      '"Calculate a $200 put at $3 premium"'
    ].join('\n'))
  }
}
