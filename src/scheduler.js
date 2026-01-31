import cron from 'node-cron'
import { scanOptions } from './data/optionsScanner.js'
import { getWatchlist, setWatchlist, getUniverse } from './skills/watchlist.js'
import { postToChannel, postToChannelById } from './lib/discord.js'

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || ''
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || ''

// Store accumulated scan results
const scanState = {
  results: [],
  currentIndex: 0,
  isScanning: false
}

export function getScanResults() {
  return [...scanState.results]
}

export function clearScanResults() {
  scanState.results = []
  scanState.currentIndex = 0
}

// ============================================
// News & Trends Functions
// ============================================

async function searchBraveNews(query, count = 10) {
  if (!BRAVE_API_KEY) return []
  
  try {
    const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=${count}&freshness=pd`
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return data.results || []
  } catch (err) {
    console.error('Brave search error:', err.message)
    return []
  }
}

async function getPolygonNews(limit = 10) {
  if (!POLYGON_API_KEY) return []
  
  try {
    const url = `https://api.polygon.io/v2/reference/news?limit=${limit}&apiKey=${POLYGON_API_KEY}`
    const resp = await fetch(url)
    if (!resp.ok) return []
    const data = await resp.json()
    return data.results || []
  } catch (err) {
    console.error('Polygon news error:', err.message)
    return []
  }
}

async function buildTrendsReport() {
  const queries = ['stock market news', 'fed interest rates', 'earnings report', 'S&P 500']
  const allArticles = []
  
  for (const q of queries) {
    const results = await searchBraveNews(q, 5)
    allArticles.push(...results)
    await new Promise(r => setTimeout(r, 200))
  }
  
  // Get Polygon news too
  const polygonNews = await getPolygonNews(10)
  
  // Extract trending topics
  const keywords = {}
  const tickers = {}
  
  for (const article of [...allArticles, ...polygonNews]) {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase()
    
    // Count keywords
    const phrases = ['fed', 'inflation', 'earnings', 'ai', 'rates', 'rally', 'sell-off', 'ipo']
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        keywords[phrase] = (keywords[phrase] || 0) + 1
      }
    }
  }
  
  // Format report
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })
  
  let message = `📊 **Hourly Trends Update** - ${timeStr} ET\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  
  // Trending topics
  const sortedKeywords = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (sortedKeywords.length > 0) {
    message += '🔥 **Trending Topics:**\n'
    for (const [word, count] of sortedKeywords) {
      message += `• ${word} (${count} mentions)\n`
    }
    message += '\n'
  }
  
  // Top headlines
  const headlines = allArticles.slice(0, 4)
  if (headlines.length > 0) {
    message += '📰 **Headlines:**\n'
    for (const h of headlines) {
      message += `• ${h.title?.slice(0, 80) || 'Untitled'}${h.title?.length > 80 ? '...' : ''}\n`
    }
  }
  
  message += `\n*Next update in 1 hour*`
  return message
}

async function buildMarketOpenReport() {
  const news = await getPolygonNews(15)
  const braveNews = await searchBraveNews('stock market premarket', 5)
  
  const now = new Date()
  let message = `🔔 **Market Open Summary** - ${now.toLocaleDateString()}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  
  if (news.length > 0 || braveNews.length > 0) {
    message += '⚡ **Pre-Market Headlines:**\n'
    const allNews = [...news.slice(0, 3), ...braveNews.slice(0, 2)]
    for (const n of allNews) {
      const title = n.title?.slice(0, 80) || 'Untitled'
      message += `• ${title}\n`
      if (n.tickers?.length) {
        message += `  └ Tickers: ${n.tickers.slice(0, 3).join(', ')}\n`
      }
    }
  }
  
  message += '\n*Good luck trading today!* 📈'
  return message
}

async function buildMarketCloseReport() {
  const news = await getPolygonNews(10)
  
  const now = new Date()
  let message = `🔔 **Market Close Summary** - ${now.toLocaleDateString()}\n`
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`
  
  if (news.length > 0) {
    message += '📰 **Today\'s Key Stories:**\n'
    for (const n of news.slice(0, 5)) {
      message += `• ${n.title?.slice(0, 80) || 'Untitled'}\n`
    }
  }
  
  message += '\n*See you tomorrow!* 🌙'
  return message
}

async function buildOpportunitiesReport() {
  const queries = [
    'trending products to sell 2026',
    'side hustle ideas',
    'freelance services in demand'
  ]
  
  const allResults = []
  for (const q of queries) {
    const results = await searchBraveNews(q, 3)
    allResults.push(...results)
    await new Promise(r => setTimeout(r, 200))
  }
  
  const now = new Date()
  let message = `🌟 **Daily Money-Making Opportunities** 🌟\n`
  message += `*${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}*\n\n`
  
  if (allResults.length > 0) {
    for (let i = 0; i < Math.min(allResults.length, 5); i++) {
      const r = allResults[i]
      message += `**${i + 1}. ${r.title?.slice(0, 70) || 'Opportunity'}**\n`
      message += `${r.description?.slice(0, 150) || ''}...\n\n`
    }
  }
  
  message += `💡 **Tips:**\n`
  message += `• Start small and validate before investing\n`
  message += `• Look for recurring income opportunities\n`
  message += `• Use your existing skills first\n`
  
  return message
}

async function checkBreakingNews(lastCheck) {
  const news = await getPolygonNews(20)
  
  // Filter for recent news (within last 30 mins)
  const recent = news.filter(n => {
    if (n.published_utc) {
      const pubTime = new Date(n.published_utc)
      return pubTime > lastCheck
    }
    return false
  })
  
  if (recent.length === 0) return null
  
  // Return the most important one
  const top = recent[0]
  let message = `⚡ **Breaking News**\n\n`
  message += `**${top.title}**\n`
  message += `*${top.publisher?.name || 'Unknown source'}*\n`
  
  if (top.tickers?.length) {
    message += `\n📊 ${top.tickers.slice(0, 5).map(t => `$${t}`).join(' ')}`
  }
  
  if (top.article_url) {
    message += `\n\n[Read more](${top.article_url})`
  }
  
  return message
}

// ============================================
// Watchlist Functions
// ============================================

// Auto-rebuild watchlist from universe
async function autoRebuildWatchlist(log, limit = 15) {
  const universe = getUniverse()
  const allResults = []
  const batchSize = 4

  await log('🔄 Auto-rebuilding watchlist from universe...')

  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize)

    try {
      const results = await scanOptions({ tickers: batch, mode: 'daily' })
      allResults.push(...results)
    } catch (err) {
      console.error(`Error scanning batch:`, err.message)
    }

    // Rate limit: wait between batches
    if (i + batchSize < universe.length) {
      await new Promise(r => setTimeout(r, 15000))
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

  const newWatchlist = ranked.map(r => r.ticker)
  
  if (newWatchlist.length > 0) {
    setWatchlist(newWatchlist)
    await log(`✅ Watchlist updated: ${newWatchlist.join(', ')}`)
  } else {
    await log('⚠️ No opportunities found, keeping existing watchlist')
  }
}

export function startScheduler({ client, CONFIG, runDaily, runWeekly, log }) {
  const BATCH_SIZE = 4
  let lastBreakingCheck = new Date()

  // Helper to post to channel by ID or name
  const postToTrends = async (msg) => {
    const guild = client.guilds.cache.first()
    if (!guild) return
    if (CONFIG.channelIds?.trends) {
      await postToChannelById(guild, CONFIG.channelIds.trends, msg)
    } else {
      await postToChannel(guild, CONFIG.channels.trends, msg)
    }
  }

  const postToAlerts = async (msg) => {
    const guild = client.guilds.cache.first()
    if (!guild) return
    if (CONFIG.channelIds?.alerts) {
      await postToChannelById(guild, CONFIG.channelIds.alerts, msg)
    } else {
      await postToChannel(guild, CONFIG.channels.alerts, msg)
    }
  }

  const postToMarket = async (msg) => {
    const guild = client.guilds.cache.first()
    if (!guild) return
    if (CONFIG.channelIds?.market) {
      await postToChannelById(guild, CONFIG.channelIds.market, msg)
    } else {
      await postToChannel(guild, CONFIG.channels.marketOpen, msg)
    }
  }

  const postToOpportunities = async (msg) => {
    const guild = client.guilds.cache.first()
    if (!guild) return
    if (CONFIG.channelIds?.opportunities) {
      await postToChannelById(guild, CONFIG.channelIds.opportunities, msg)
    } else {
      await postToChannel(guild, CONFIG.channels.opportunities, msg)
    }
  }

  // ============================================
  // Options Scanner (existing)
  // ============================================

  // Run batch scanner every minute during market hours (Mon-Fri, 8am-4pm)
  cron.schedule('* 8-16 * * 1-5', async () => {
    if (scanState.isScanning) return

    const tickers = getWatchlist()
    if (tickers.length === 0) return

    const start = scanState.currentIndex
    const batch = tickers.slice(start, start + BATCH_SIZE)

    if (batch.length === 0) {
      scanState.currentIndex = 0
      return
    }

    scanState.isScanning = true
    try {
      console.log(`🔄 Scanning batch: ${batch.join(', ')}`)
      const results = await scanOptions({ tickers: batch, mode: 'daily' })
      
      for (const r of results) {
        const existing = scanState.results.findIndex(x => x.ticker === r.ticker && x.strike === r.strike)
        if (existing >= 0) {
          scanState.results[existing] = r
        } else {
          scanState.results.push(r)
        }
      }

      scanState.results.sort((a, b) => b.score - a.score)
      scanState.results = scanState.results.slice(0, 50)
      scanState.currentIndex += BATCH_SIZE
    } catch (err) {
      console.error('Batch scan error:', err.message)
    } finally {
      scanState.isScanning = false
    }
  }, { timezone: CONFIG.timezone })

  // Auto-rebuild watchlist daily at 7:30am Mon-Fri
  cron.schedule('30 7 * * 1-5', async () => {
    try {
      await autoRebuildWatchlist(log, 15)
    } catch (err) {
      console.error('Watchlist rebuild error:', err)
      await log(`❌ Watchlist rebuild failed: ${err.message}`)
    }
  }, { timezone: CONFIG.timezone })

  // Daily options report
  cron.schedule(CONFIG.schedule.daily, async () => {
    await log(`⏰ Running daily scan...`)
    await runDaily()
    clearScanResults()
  }, { timezone: CONFIG.timezone })

  // Weekly options report
  cron.schedule(CONFIG.schedule.weekly, async () => {
    await log(`⏰ Running weekly review...`)
    await runWeekly()
  }, { timezone: CONFIG.timezone })

  // ============================================
  // NEW: Hourly Trends (every hour)
  // ============================================
  cron.schedule(CONFIG.schedule.hourlyTrends || '0 * * * *', async () => {
    try {
      console.log('📊 Running hourly trends...')
      const report = await buildTrendsReport()
      await postToTrends(report)
      await log('✅ Hourly trends posted.')
    } catch (err) {
      console.error('Hourly trends error:', err.message)
    }
  }, { timezone: CONFIG.timezone })

  // ============================================
  // NEW: Market Open Summary (9:30 AM Mon-Fri)
  // ============================================
  cron.schedule(CONFIG.schedule.marketOpen || '30 9 * * 1-5', async () => {
    try {
      console.log('🔔 Running market open summary...')
      const report = await buildMarketOpenReport()
      await postToMarket(report)
      await log('✅ Market open summary posted.')
    } catch (err) {
      console.error('Market open error:', err.message)
    }
  }, { timezone: CONFIG.timezone })

  // ============================================
  // NEW: Market Close Summary (4:00 PM Mon-Fri)
  // ============================================
  cron.schedule(CONFIG.schedule.marketClose || '0 16 * * 1-5', async () => {
    try {
      console.log('🔔 Running market close summary...')
      const report = await buildMarketCloseReport()
      await postToMarket(report)
      await log('✅ Market close summary posted.')
    } catch (err) {
      console.error('Market close error:', err.message)
    }
  }, { timezone: CONFIG.timezone })

  // ============================================
  // NEW: Daily Opportunities (8:00 AM daily)
  // ============================================
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('🌟 Running opportunities report...')
      const report = await buildOpportunitiesReport()
      await postToOpportunities(report)
      await log('✅ Opportunities report posted.')
    } catch (err) {
      console.error('Opportunities error:', err.message)
    }
  }, { timezone: CONFIG.timezone })

  // ============================================
  // NEW: Breaking News Check (every 15 mins, Mon-Fri)
  // ============================================
  cron.schedule('*/15 8-17 * * 1-5', async () => {
    try {
      const alert = await checkBreakingNews(lastBreakingCheck)
      lastBreakingCheck = new Date()
      
      if (alert) {
        console.log('⚡ Breaking news detected!')
        await postToAlerts(alert)
        await log('⚡ Breaking news alert posted.')
      }
    } catch (err) {
      console.error('Breaking news check error:', err.message)
    }
  }, { timezone: CONFIG.timezone })

  console.log('✅ All schedulers started')
  return true
}
