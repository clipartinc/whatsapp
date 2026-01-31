import express from 'express'
import { getWatchlist, getUniverse } from './skills/watchlist.js'
import { getScanResults } from './scheduler.js'

const app = express()
const PORT = process.env.DASHBOARD_PORT || 3001
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''

// Basic auth middleware
function requireAuth(req, res, next) {
  // If no password set, allow access (dev mode)
  if (!DASHBOARD_PASSWORD) {
    console.warn('⚠️ DASHBOARD_PASSWORD not set - dashboard is public!')
    return next()
  }

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Moltbot Dashboard"')
    return res.status(401).send('Authentication required')
  }

  // Decode base64 credentials
  const base64 = authHeader.split(' ')[1]
  const [username, password] = Buffer.from(base64, 'base64').toString().split(':')

  // Check password (username can be anything)
  if (password === DASHBOARD_PASSWORD) {
    return next()
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Moltbot Dashboard"')
  return res.status(401).send('Invalid credentials')
}

// Apply auth to all routes
app.use(requireAuth)

// Dashboard HTML
app.get('/', (req, res) => {
  const watchlist = getWatchlist()
  const universe = getUniverse()
  const results = getScanResults()
  const top10 = results.slice(0, 10)

  // Calculate stats
  const avgIV = results.length > 0 
    ? (results.reduce((sum, r) => sum + parseFloat(r.iv || 0), 0) / results.length).toFixed(1)
    : 0
  const avgDelta = results.length > 0
    ? (results.reduce((sum, r) => sum + parseFloat(r.delta || 0), 0) / results.length).toFixed(2)
    : 0
  const putCount = results.filter(r => r.strategy?.includes('Put')).length
  const callCount = results.filter(r => r.strategy?.includes('Call')).length

  // Group by ticker for ticker stats
  const tickerCounts = {}
  results.forEach(r => {
    tickerCounts[r.ticker] = (tickerCounts[r.ticker] || 0) + 1
  })
  const topTickers = Object.entries(tickerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="60">
  <title>Moltbot Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { 
      font-size: 2rem; 
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h1 span { font-size: 2.5rem; }
    h2 { 
      font-size: 1.2rem; 
      color: #94a3b8;
      margin-bottom: 15px;
      border-bottom: 1px solid #334155;
      padding-bottom: 8px;
    }
    .grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .stat-value { 
      font-size: 2rem; 
      font-weight: bold;
      color: #60a5fa;
    }
    .stat-label { 
      font-size: 0.85rem; 
      color: #94a3b8;
      margin-top: 5px;
    }
    .tag {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
      margin: 3px;
    }
    .tag.put { background: #ef4444; }
    .tag.call { background: #22c55e; }
    table { 
      width: 100%; 
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th { 
      text-align: left; 
      padding: 12px 8px;
      border-bottom: 2px solid #334155;
      color: #94a3b8;
      font-weight: 500;
    }
    td { 
      padding: 12px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    tr:hover { background: rgba(255,255,255,0.03); }
    .score {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: bold;
    }
    .strategy-put { color: #f87171; }
    .strategy-call { color: #4ade80; }
    .updated {
      text-align: center;
      color: #64748b;
      font-size: 0.8rem;
      margin-top: 20px;
    }
    .empty {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><span>📊</span> Moltbot Dashboard</h1>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Opportunities Found</div>
      </div>
      <div class="stat">
        <div class="stat-value">${avgIV}%</div>
        <div class="stat-label">Avg IV</div>
      </div>
      <div class="stat">
        <div class="stat-value">${putCount}</div>
        <div class="stat-label">Put Opportunities</div>
      </div>
      <div class="stat">
        <div class="stat-value">${callCount}</div>
        <div class="stat-label">Call Opportunities</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>📌 Watchlist (${watchlist.length})</h2>
        <div>
          ${watchlist.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="card">
        <h2>🔥 Most Active Tickers</h2>
        <div>
          ${topTickers.length > 0 
            ? topTickers.map(([ticker, count]) => `<span class="tag">${ticker} (${count})</span>`).join('')
            : '<span class="empty">No data yet</span>'}
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🎯 Top Opportunities</h2>
      ${top10.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Ticker</th>
            <th>Strategy</th>
            <th>Expiry</th>
            <th>Strike</th>
            <th>Mid</th>
            <th>Delta</th>
            <th>IV</th>
            <th>OI</th>
            <th>Spread</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          ${top10.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${r.ticker}</strong></td>
            <td class="${r.strategy?.includes('Put') ? 'strategy-put' : 'strategy-call'}">${r.strategy}</td>
            <td>${r.expiry}</td>
            <td>$${r.strike}</td>
            <td>$${r.mid}</td>
            <td>${r.delta}</td>
            <td>${r.iv}%</td>
            <td>${r.oi?.toLocaleString()}</td>
            <td>${r.spreadPct}%</td>
            <td class="score">${r.score?.toFixed(1)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ` : '<div class="empty">No opportunities found yet. Scanning in progress...</div>'}
    </div>

    <div class="card" style="margin-top: 20px;">
      <h2>🌐 Universe (${universe.length} stocks)</h2>
      <div>
        ${universe.map(t => `<span class="tag" style="background: #475569;">${t}</span>`).join('')}
      </div>
    </div>

    <p class="updated">Auto-refreshes every 60 seconds • Last updated: ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`)
})

// API endpoints for raw data
app.get('/api/watchlist', (req, res) => {
  res.json({ watchlist: getWatchlist() })
})

app.get('/api/opportunities', (req, res) => {
  res.json({ opportunities: getScanResults() })
})

app.get('/api/stats', (req, res) => {
  const results = getScanResults()
  res.json({
    total: results.length,
    avgIV: results.length > 0 
      ? (results.reduce((sum, r) => sum + parseFloat(r.iv || 0), 0) / results.length).toFixed(1)
      : 0,
    puts: results.filter(r => r.strategy?.includes('Put')).length,
    calls: results.filter(r => r.strategy?.includes('Call')).length
  })
})

export function startDashboard() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Dashboard running at http://localhost:${PORT}`)
  })
}
