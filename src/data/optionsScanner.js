const POLYGON_API_KEY = process.env.POLYGON_API_KEY || ''

// Fetch current stock price
async function getStockPrice(ticker) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  if (!resp.ok) return null
  const data = await resp.json()
  return data.results?.[0]?.c || null // closing price
}

// Fetch options chain for a ticker
async function getOptionsChain(ticker, expirationDate) {
  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&expiration_date=${expirationDate}&limit=100&apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()
  return data.results || []
}

// Fetch options snapshot (greeks, IV, prices)
async function getOptionsSnapshot(ticker) {
  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${POLYGON_API_KEY}`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()
  return data.results || []
}

// Calculate target expiration date
function getTargetExpiry(mode) {
  const now = new Date()
  const daysOut = mode === 'weekly' ? 7 : 30
  const target = new Date(now.getTime() + daysOut * 24 * 60 * 60 * 1000)
  return target.toISOString().split('T')[0]
}

// Find the nearest Friday expiration
function getNearestFriday(targetDate, options) {
  const expirations = [...new Set(options.map(o => o.expiration_date))].sort()
  return expirations.find(exp => exp >= targetDate) || expirations[0]
}

// Score and filter options for opportunities
function scoreOption(opt, stockPrice, mode) {
  const details = opt.details || {}
  const greeks = opt.greeks || {}
  const day = opt.day || {}

  const strike = details.strike_price
  const contractType = details.contract_type // call or put
  const expiry = details.expiration_date
  const delta = Math.abs(greeks.delta || 0)
  const iv = greeks.implied_volatility || 0
  const oi = day.open_interest || 0
  const bid = day.bid || opt.last_quote?.bid || 0
  const ask = day.ask || opt.last_quote?.ask || 0
  const mid = (bid + ask) / 2
  const spread = ask > 0 ? ((ask - bid) / ask) * 100 : 100

  // Filters
  const isOTM = contractType === 'call' ? strike > stockPrice : strike < stockPrice
  const goodDelta = delta >= 0.15 && delta <= 0.35
  const goodLiquidity = oi >= 100 && spread < 10
  const goodPremium = mid >= 0.50

  if (!isOTM || !goodDelta || !goodLiquidity || !goodPremium) return null

  // Strategy based on mode
  const strategy = contractType === 'put' ? 'Cash-Secured Put' : 'Covered Call'

  // Score: higher IV + lower spread + better delta = better
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
    score,
    why: [
      `${(delta * 100).toFixed(0)}Δ OTM ${contractType}`,
      `IV: ${(iv * 100).toFixed(0)}%`,
      `Good liquidity (OI: ${oi})`
    ]
  }
}

export async function scanOptions({ tickers = [], mode = 'daily' } = {}) {
  if (!POLYGON_API_KEY) {
    console.warn('⚠️ POLYGON_API_KEY not set')
    return []
  }

  const universe = tickers.length ? tickers : ['SPY', 'TSLA', 'NVDA', 'AAPL', 'AMZN']
  const opportunities = []

  for (const ticker of universe.slice(0, 10)) {
    try {
      // Rate limit: Polygon free tier is 5 calls/min
      await sleep(250)

      const stockPrice = await getStockPrice(ticker)
      if (!stockPrice) continue

      const snapshot = await getOptionsSnapshot(ticker)
      if (!snapshot.length) continue

      // Filter to target expiry range
      const targetDate = getTargetExpiry(mode)
      const filtered = snapshot.filter(opt => {
        const exp = opt.details?.expiration_date
        if (!exp) return false
        const daysToExp = (new Date(exp) - new Date()) / (1000 * 60 * 60 * 24)
        return mode === 'weekly' 
          ? daysToExp >= 3 && daysToExp <= 14
          : daysToExp >= 20 && daysToExp <= 45
      })

      // Score each option
      for (const opt of filtered) {
        const scored = scoreOption(opt, stockPrice, mode)
        if (scored) opportunities.push(scored)
      }
    } catch (err) {
      console.error(`Error scanning ${ticker}:`, err.message)
    }
  }

  // Sort by score descending
  return opportunities.sort((a, b) => b.score - a.score)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
  