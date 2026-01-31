// Earnings calendar and company news fetcher
const POLYGON_API_KEY = process.env.POLYGON_API_KEY || ''

// Get upcoming earnings for a list of tickers
export async function getUpcomingEarnings(tickers = []) {
  if (!POLYGON_API_KEY) {
    console.warn('⚠️ POLYGON_API_KEY not set')
    return []
  }

  const earnings = []
  
  for (const ticker of tickers.slice(0, 10)) {
    try {
      // Polygon's ticker details includes next earnings date
      const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`
      const resp = await fetch(url)
      
      if (!resp.ok) continue
      
      const data = await resp.json()
      const details = data.results
      
      if (details) {
        earnings.push({
          ticker,
          name: details.name,
          marketCap: details.market_cap,
          sector: details.sic_description
        })
      }
      
      // Rate limit
      await sleep(200)
    } catch (err) {
      console.error(`Error fetching ${ticker} details:`, err.message)
    }
  }

  return earnings
}

// Get recent news for a ticker
export async function getTickerNews(ticker, limit = 5) {
  if (!POLYGON_API_KEY) {
    return []
  }

  try {
    const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=${limit}&apiKey=${POLYGON_API_KEY}`
    const resp = await fetch(url)
    
    if (!resp.ok) return []
    
    const data = await resp.json()
    return (data.results || []).map(article => ({
      title: article.title,
      description: article.description,
      published: article.published_utc,
      source: article.publisher?.name,
      url: article.article_url,
      sentiment: article.insights?.[0]?.sentiment
    }))
  } catch (err) {
    console.error(`Error fetching news for ${ticker}:`, err.message)
    return []
  }
}

// Get news for multiple tickers
export async function getWatchlistNews(tickers = [], limit = 3) {
  const allNews = []
  
  for (const ticker of tickers.slice(0, 10)) {
    const news = await getTickerNews(ticker, limit)
    allNews.push(...news.map(n => ({ ...n, ticker })))
    await sleep(200)
  }
  
  // Sort by date, newest first
  return allNews.sort((a, b) => 
    new Date(b.published) - new Date(a.published)
  )
}

// Free earnings calendar from external API (alternative)
export async function getEarningsCalendar(days = 7) {
  // Using a free earnings API as backup
  try {
    const today = new Date()
    const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
    
    const fromStr = today.toISOString().split('T')[0]
    const toStr = endDate.toISOString().split('T')[0]
    
    // Polygon earnings endpoint (requires subscription)
    if (POLYGON_API_KEY) {
      const url = `https://api.polygon.io/vX/reference/financials?filing_date.gte=${fromStr}&filing_date.lte=${toStr}&limit=50&apiKey=${POLYGON_API_KEY}`
      const resp = await fetch(url)
      if (resp.ok) {
        const data = await resp.json()
        return data.results || []
      }
    }
    
    return []
  } catch (err) {
    console.error('Error fetching earnings calendar:', err.message)
    return []
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
