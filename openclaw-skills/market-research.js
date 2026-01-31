/**
 * OpenClaw Skill: Market Research
 * Fetches company news, earnings info, and stock details
 * 
 * Usage: "get news for TSLA" or "when is NVDA earnings?"
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY || ''

/**
 * Get recent news for a ticker
 * @param {string} ticker - Stock symbol
 * @param {number} limit - Max articles to return
 */
export async function getNews(ticker, limit = 5) {
  if (!POLYGON_API_KEY) {
    return { error: 'POLYGON_API_KEY not configured' }
  }

  const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=${limit}&apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  
  if (!resp.ok) {
    return { error: `Failed to fetch news: ${resp.status}` }
  }

  const data = await resp.json()
  return (data.results || []).map(article => ({
    title: article.title,
    description: article.description?.slice(0, 200),
    published: article.published_utc,
    source: article.publisher?.name,
    url: article.article_url,
    sentiment: article.insights?.[0]?.sentiment
  }))
}

/**
 * Get company details
 * @param {string} ticker - Stock symbol
 */
export async function getCompanyInfo(ticker) {
  if (!POLYGON_API_KEY) {
    return { error: 'POLYGON_API_KEY not configured' }
  }

  const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  
  if (!resp.ok) {
    return { error: `Failed to fetch company info: ${resp.status}` }
  }

  const data = await resp.json()
  const r = data.results

  return {
    ticker: r.ticker,
    name: r.name,
    description: r.description?.slice(0, 500),
    sector: r.sic_description,
    marketCap: r.market_cap,
    employees: r.total_employees,
    website: r.homepage_url,
    exchange: r.primary_exchange
  }
}

/**
 * Get current stock quote
 * @param {string} ticker - Stock symbol
 */
export async function getQuote(ticker) {
  if (!POLYGON_API_KEY) {
    return { error: 'POLYGON_API_KEY not configured' }
  }

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  
  if (!resp.ok) {
    return { error: `Failed to fetch quote: ${resp.status}` }
  }

  const data = await resp.json()
  const r = data.results?.[0]
  
  if (!r) {
    return { error: `No quote data for ${ticker}` }
  }

  return {
    ticker,
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
    vwap: r.vw,
    date: new Date(r.t).toISOString().split('T')[0]
  }
}

/**
 * Search for tickers by name or keyword
 * @param {string} query - Search term
 */
export async function searchTickers(query, limit = 10) {
  if (!POLYGON_API_KEY) {
    return { error: 'POLYGON_API_KEY not configured' }
  }

  const url = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=${limit}&apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  
  if (!resp.ok) {
    return { error: `Search failed: ${resp.status}` }
  }

  const data = await resp.json()
  return (data.results || []).map(r => ({
    ticker: r.ticker,
    name: r.name,
    market: r.market,
    type: r.type
  }))
}

/**
 * Get market movers (gainers/losers)
 * Note: Requires Polygon paid plan
 */
export async function getMarketMovers(direction = 'gainers') {
  if (!POLYGON_API_KEY) {
    return { error: 'POLYGON_API_KEY not configured' }
  }

  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/${direction}?apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  
  if (!resp.ok) {
    return { error: `Failed to fetch movers: ${resp.status}` }
  }

  const data = await resp.json()
  return (data.tickers || []).slice(0, 10).map(t => ({
    ticker: t.ticker,
    price: t.day?.c,
    change: t.todaysChange,
    changePercent: t.todaysChangePerc?.toFixed(2),
    volume: t.day?.v
  }))
}
