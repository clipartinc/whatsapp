import { scanOptions } from '../data/optionsScanner.js'

// Universe of liquid options stocks to scan for opportunities
const UNIVERSE = [
  // Major ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'GLD', 'SLV', 'TLT',
  // Mega caps with liquid options
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'NFLX', 'CRM',
  // Other popular options stocks
  'COIN', 'PLTR', 'SOFI', 'RIVN', 'NIO', 'BABA', 'UBER', 'SQ', 'SHOP', 'SNOW',
  'BA', 'DIS', 'JPM', 'V', 'MA', 'WMT', 'HD', 'LOW', 'COST', 'TGT'
]

const state = {
  tickers: ['SPY', 'TSLA', 'NVDA']
}

export function getWatchlist() {
  return [...state.tickers]
}

export function setWatchlist(tickers) {
  state.tickers = [...tickers]
}

export function getUniverse() {
  return [...UNIVERSE]
}

// Auto-discover best tickers based on options opportunities
async function autoDiscoverWatchlist(limit = 10, log) {
  if (log) await log('🔍 Scanning universe for best options opportunities...')
  
  const allResults = []
  
  // Scan in batches to respect rate limits
  const batchSize = 4
  for (let i = 0; i < UNIVERSE.length; i += batchSize) {
    const batch = UNIVERSE.slice(i, i + batchSize)
    
    try {
      const results = await scanOptions({ tickers: batch, mode: 'daily' })
      allResults.push(...results)
    } catch (err) {
      console.error(`Error scanning batch:`, err.message)
    }
    
    // Rate limit: wait between batches
    if (i + batchSize < UNIVERSE.length) {
      await new Promise(r => setTimeout(r, 15000)) // 15s between batches (4 calls/min)
    }
  }
  
  // Group by ticker and get best score per ticker
  const tickerScores = {}
  for (const r of allResults) {
    if (!tickerScores[r.ticker] || r.score > tickerScores[r.ticker].score) {
      tickerScores[r.ticker] = r
    }
  }
  
  // Sort by score and take top N
  const ranked = Object.values(tickerScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  
  return ranked.map(r => r.ticker)
}

export default {
  name: 'watchlist',
  match: async ({ isAdminChannel, text }) =>
    isAdminChannel && (text.startsWith('!watchlist ') || text === '!watchlist'),

  run: async ({ message, textRaw, log }) => {
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

    // !watchlist auto - auto-discover best tickers
    if (parts[1] === 'auto') {
      const limit = parseInt(parts[2]) || 10
      await message.reply(`🔍 Scanning ${UNIVERSE.length} stocks for best options opportunities... This takes ~${Math.ceil(UNIVERSE.length / 4) * 15}s`)
      
      try {
        const discovered = await autoDiscoverWatchlist(limit, log)
        
        if (discovered.length === 0) {
          return message.reply('⚠️ No opportunities found. Check POLYGON_API_KEY.')
        }
        
        state.tickers = discovered
        return message.reply(`✅ Auto-built watchlist (top ${limit}):\n📌 ${state.tickers.join(', ')}`)
      } catch (err) {
        console.error('Auto-discover error:', err)
        return message.reply(`❌ Error: ${err.message}`)
      }
    }

    // !watchlist universe - show what stocks are scanned
    if (parts[1] === 'universe') {
      return message.reply(`🌐 Universe (${UNIVERSE.length} stocks):\n${UNIVERSE.join(', ')}`)
    }

    return message.reply('Usage:\n• `!watchlist` - show current\n• `!watchlist add TICKER1,TICKER2`\n• `!watchlist remove TICKER`\n• `!watchlist auto [limit]` - auto-build from opportunities\n• `!watchlist universe` - show scannable stocks')
  }
}
