import { askAI, analyzeOpportunity } from '../lib/ai.js'
import { scanOptions } from '../data/optionsScanner.js'
import { getTickerNews } from '../data/earnings.js'
import { getScanResults } from '../scheduler.js'
import { getWatchlist } from './watchlist.js'
import { bullets } from '../lib/format.js'

// Detect what the user wants
function detectIntent(text) {
  const lower = text.toLowerCase()
  
  // Scan for options
  if (lower.match(/\b(scan|find|search|look for|show|get).*(put|call|option)/i)) {
    const tickerMatch = text.match(/\b([A-Z]{1,5})\b/)
    return { action: 'scan', ticker: tickerMatch?.[0] }
  }
  
  // News request
  if (lower.match(/\b(news|headlines|latest|happening|going on)/i)) {
    const tickerMatch = text.match(/\b([A-Z]{1,5})\b/)
    return { action: 'news', ticker: tickerMatch?.[0] }
  }
  
  // Calculate
  if (lower.match(/\b(calculate|calc|profit|return|break.?even)/i)) {
    return { action: 'calculate' }
  }
  
  return { action: 'chat' }
}

// Extract ticker from text
function extractTicker(text) {
  // Common tickers to look for
  const tickers = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'COIN', 'PLTR', 'BA', 'DIS', 'GLD', 'SLV']
  const upper = text.toUpperCase()
  
  for (const t of tickers) {
    if (upper.includes(t)) return t
  }
  
  // Try to find any 2-5 letter uppercase word
  const match = text.match(/\b([A-Z]{2,5})\b/)
  return match?.[1] || null
}

export default {
  name: 'chat',
  match: async ({ isAdminChannel, text }) => {
    if (!isAdminChannel) return false
    if (text.startsWith('!')) return false
    if (text === 'ping') return false
    return text.length > 3
  },

  run: async ({ message, textRaw, log }) => {
    const question = textRaw.trim()
    const intent = detectIntent(question)
    const ticker = extractTicker(question) || intent.ticker
    
    await message.channel.sendTyping()
    
    try {
      // SCAN: Actually run the scanner
      if (intent.action === 'scan' && ticker) {
        await message.reply(`🔍 Scanning ${ticker} for options opportunities...`)
        
        const results = await scanOptions({ tickers: [ticker], mode: 'daily' })
        
        if (results.length === 0) {
          return message.reply(`No opportunities found for ${ticker}. This could mean:\n• No options match our criteria (15-35 delta, good liquidity)\n• POLYGON_API_KEY not set\n• Market is closed`)
        }
        
        const top5 = results.slice(0, 5)
        const lines = [
          `**${ticker} Options Opportunities**`,
          ''
        ]
        
        top5.forEach((r, i) => {
          lines.push(
            `**${i + 1}. ${r.strategy}** - $${r.strike} strike`,
            bullets([
              `Expiry: ${r.expiry}`,
              `Premium: $${r.mid} | Delta: ${r.delta} | IV: ${r.iv}%`,
              `Open Interest: ${r.oi} | Spread: ${r.spreadPct}%`
            ]),
            ''
          )
        })
        
        return message.reply(lines.join('\n'))
      }
      
      // NEWS: Fetch actual news
      if (intent.action === 'news' && ticker) {
        await message.reply(`📰 Fetching news for ${ticker}...`)
        
        const news = await getTickerNews(ticker, 5)
        
        if (!news || news.length === 0) {
          return message.reply(`No recent news found for ${ticker}.`)
        }
        
        const lines = [
          `**${ticker} News**`,
          '',
          ...news.map(n => `• **${n.title}**\n  ${n.source} • ${new Date(n.published).toLocaleDateString()}`)
        ]
        
        return message.reply(lines.join('\n'))
      }
      
      // CALCULATE or general CHAT: Use AI
      const watchlist = getWatchlist()
      const opportunities = getScanResults().slice(0, 5)
      
      const systemPrompt = `You are moltbot, an options trading assistant. You help find premium-selling opportunities (covered calls, cash-secured puts).

Current watchlist: ${watchlist.join(', ')}

${opportunities.length > 0 ? `Recent scan results:\n${opportunities.map(o => 
  `- ${o.ticker}: ${o.strategy} $${o.strike} exp ${o.expiry} (IV: ${o.iv}%, Delta: ${o.delta}, Premium: $${o.mid})`
).join('\n')}` : 'No recent scan results.'}

If asked to scan or find options, tell them you're scanning and provide specific opportunities.
If asked to calculate, do the math and show the numbers.
Be concise. Use Discord markdown formatting.`

      const answer = await askAI(question, systemPrompt)
      
      if (answer.length > 1900) {
        const chunks = answer.match(/.{1,1900}/gs) || [answer]
        for (const chunk of chunks) {
          await message.reply(chunk)
        }
      } else {
        await message.reply(answer)
      }
    } catch (err) {
      console.error('Chat error:', err)
      
      if (err.message.includes('OPENAI_API_KEY')) {
        return message.reply('⚠️ AI not configured. Set `OPENAI_API_KEY` in environment.\n\nUse commands instead: `!scan`, `!news TICKER`, `!help`')
      }
      
      return message.reply(`❌ Error: ${err.message}`)
    }
  }
}
