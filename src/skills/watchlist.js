const state = {
    tickers: ['SPY', 'TSLA', 'NVDA']
  }
  
  export function getWatchlist() {
    return [...state.tickers]
  }
  
  export default {
    name: 'watchlist',
    match: async ({ isAdminChannel, text }) =>
      isAdminChannel && (text.startsWith('!watchlist ') || text === '!watchlist'),
  
    run: async ({ message, textRaw }) => {
      const parts = textRaw.trim().split(/\s+/)
      // !watchlist show
      if (parts[1] === 'show' || parts.length === 1) {
        return message.reply(`📌 Watchlist: ${state.tickers.join(', ')}`)
      }
  
      // !watchlist add TSLA,NVDA
      if (parts[1] === 'add') {
        const list = (parts.slice(2).join(' ') || '')
          .split(',')
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
  
        const merged = new Set([...state.tickers, ...list])
        state.tickers = [...merged]
        return message.reply(`✅ Added. Watchlist: ${state.tickers.join(', ')}`)
      }
  
      // !watchlist remove TSLA
      if (parts[1] === 'remove') {
        const list = (parts.slice(2).join(' ') || '')
          .split(',')
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
  
        state.tickers = state.tickers.filter(t => !list.includes(t))
        return message.reply(`✅ Removed. Watchlist: ${state.tickers.join(', ')}`)
      }
  
      return message.reply('Usage: `!watchlist show | add TICKER1,TICKER2 | remove TICKER`')
    }
  }
  