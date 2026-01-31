// TODO: Replace this with real data provider (Polygon/Tradier/etc.)
export async function scanOptions({ tickers = [], mode = 'daily' } = {}) {
    const now = new Date()
    const sample = (t) => ({
      ticker: t,
      strategy: mode === 'weekly' ? 'Cash-Secured Put' : 'Covered Call',
      expiry: mode === 'weekly' ? '2026-03-06' : '2026-02-20',
      strike: mode === 'weekly' ? 190 : 215,
      mid: mode === 'weekly' ? 3.85 : 2.15,
      delta: mode === 'weekly' ? -0.22 : 0.18,
      ivRank: mode === 'weekly' ? 62 : 48,
      oi: mode === 'weekly' ? 3421 : 1250,
      spreadPct: mode === 'weekly' ? 2.8 : 3.5,
      why: [
        'Liquidity meets thresholds',
        'DTE in target window',
        'No earnings filter applied (placeholder)'
      ],
      timestamp: now.toISOString()
    })
  
    // basic defaults if no tickers supplied
    const universe = tickers.length ? tickers : ['SPY', 'TSLA', 'NVDA', 'AAPL', 'AMZN']
    return universe.slice(0, 10).map(sample)
  }
  