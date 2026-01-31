/**
 * OpenClaw Skill: Options Scanner
 * Scans for premium-selling opportunities (covered calls, cash-secured puts)
 * 
 * Usage: "scan for options opportunities" or "find puts to sell on NVDA"
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY || ''

// Fetch current stock price
async function getStockPrice(ticker) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  if (!resp.ok) return null
  const data = await resp.json()
  return data.results?.[0]?.c || null
}

// Fetch options snapshot with greeks
async function getOptionsSnapshot(ticker) {
  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()
  return data.results || []
}

// Score options for premium-selling
function scoreOption(opt, stockPrice) {
  const details = opt.details || {}
  const greeks = opt.greeks || {}
  const day = opt.day || {}

  const strike = details.strike_price
  const contractType = details.contract_type
  const expiry = details.expiration_date
  const delta = Math.abs(greeks.delta || 0)
  const iv = greeks.implied_volatility || 0
  const oi = day.open_interest || 0
  const bid = day.bid || opt.last_quote?.bid || 0
  const ask = day.ask || opt.last_quote?.ask || 0
  const mid = (bid + ask) / 2
  const spread = ask > 0 ? ((ask - bid) / ask) * 100 : 100

  // Filters for good premium-selling setups
  const isOTM = contractType === 'call' ? strike > stockPrice : strike < stockPrice
  const goodDelta = delta >= 0.15 && delta <= 0.35
  const goodLiquidity = oi >= 100 && spread < 10
  const goodPremium = mid >= 0.50

  if (!isOTM || !goodDelta || !goodLiquidity || !goodPremium) return null

  const strategy = contractType === 'put' ? 'Cash-Secured Put' : 'Covered Call'
  const score = iv * 100 - spread + (0.25 - Math.abs(delta - 0.25)) * 50

  return {
    ticker: details.underlying_ticker,
    strategy,
    expiry,
    strike,
    contractType,
    mid: mid.toFixed(2),
    delta: delta.toFixed(2),
    iv: (iv * 100).toFixed(1),
    oi,
    spreadPct: spread.toFixed(1),
    score
  }
}

/**
 * Scan a ticker for options opportunities
 * @param {string} ticker - Stock symbol (e.g., "NVDA")
 * @param {string} mode - "daily" (20-45 DTE) or "weekly" (3-14 DTE)
 * @returns {Array} Sorted opportunities
 */
export async function scanTicker(ticker, mode = 'daily') {
  if (!POLYGON_API_KEY) {
    return { error: 'POLYGON_API_KEY not configured' }
  }

  const stockPrice = await getStockPrice(ticker)
  if (!stockPrice) {
    return { error: `Could not fetch price for ${ticker}` }
  }

  const snapshot = await getOptionsSnapshot(ticker)
  if (!snapshot.length) {
    return { error: `No options data for ${ticker}` }
  }

  // Filter by expiry range
  const filtered = snapshot.filter(opt => {
    const exp = opt.details?.expiration_date
    if (!exp) return false
    const daysToExp = (new Date(exp) - new Date()) / (1000 * 60 * 60 * 24)
    return mode === 'weekly'
      ? daysToExp >= 3 && daysToExp <= 14
      : daysToExp >= 20 && daysToExp <= 45
  })

  const opportunities = []
  for (const opt of filtered) {
    const scored = scoreOption(opt, stockPrice)
    if (scored) opportunities.push(scored)
  }

  return opportunities.sort((a, b) => b.score - a.score).slice(0, 10)
}

/**
 * Scan multiple tickers
 * @param {string[]} tickers - Array of symbols
 * @param {string} mode - "daily" or "weekly"
 */
export async function scanMultiple(tickers, mode = 'daily') {
  const allResults = []
  
  for (const ticker of tickers.slice(0, 10)) {
    const results = await scanTicker(ticker, mode)
    if (!results.error) {
      allResults.push(...results)
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 300))
  }

  return allResults.sort((a, b) => b.score - a.score).slice(0, 15)
}

// Default universe of liquid options stocks
export const UNIVERSE = [
  'SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'GDX',
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD',
  'COIN', 'PLTR', 'SOFI', 'NIO', 'BA', 'DIS'
]
