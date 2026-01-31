# OpenClaw Trading Skills

Options trading tools for ClawBot - scan for opportunities, research stocks, and calculate positions.

## Setup

### 1. Get a Polygon.io API Key

Sign up at [polygon.io](https://polygon.io) (free tier available).

### 2. Add to OpenClaw Environment

```bash
# In your Railway environment variables, or .env file:
POLYGON_API_KEY=your_key_here
```

### 3. Copy Skills to Workspace

Copy the `openclaw-skills/` folder to your OpenClaw workspace directory.

## What You Can Ask ClawBot

### Options Scanning
- "Scan NVDA for options opportunities"
- "Find puts to sell on SPY"
- "What are the best covered calls on TSLA?"
- "Scan AMD, NVDA, and AAPL for weekly options"

### Market Research
- "Get news for Tesla"
- "What's the latest on NVDA?"
- "Look up company info for Apple"
- "Get me a quote on SPY"
- "Search for gold mining stocks"

### Calculations
- "Calculate profit on a $200 put at $3.50 premium"
- "What's my return if I sell a covered call at $150 strike for $2?"
- "How many contracts can I sell with $50k and 2% risk?"
- "Annualize a 2% return over 30 days"
- "Walk me through the wheel strategy on AMD at $120"

## Functions Reference

### Options Scanner

| Function | Description |
|----------|-------------|
| `scanTicker(ticker, mode)` | Scan single stock ("daily" or "weekly") |
| `scanMultiple(tickers, mode)` | Scan multiple stocks |

### Market Research

| Function | Description |
|----------|-------------|
| `getNews(ticker, limit)` | Recent news articles |
| `getCompanyInfo(ticker)` | Company details, sector, market cap |
| `getQuote(ticker)` | Current price, volume, VWAP |
| `searchTickers(query)` | Search by name |
| `getMarketMovers(direction)` | Top gainers/losers |

### Calculators

| Function | Description |
|----------|-------------|
| `cashSecuredPut(strike, premium)` | CSP metrics |
| `coveredCall(stock, strike, premium)` | CC metrics |
| `positionSize(account, risk%, strike)` | Position sizing |
| `annualizeReturn(return%, days)` | Annualized return |
| `wheelStrategy(strike, putPrem, callPrem)` | Wheel metrics |

## Criteria for Options Scanning

The scanner looks for premium-selling setups with:

- **Delta**: 0.15 - 0.35 (OTM sweet spot)
- **Open Interest**: 100+ contracts
- **Bid/Ask Spread**: Under 10%
- **Premium**: At least $0.50
- **DTE**: Daily mode (20-45 days), Weekly mode (3-14 days)

Higher IV + tighter spreads + better delta = higher score.

## Example Responses

**Scan Request:**
```
User: Scan NVDA for put opportunities

ClawBot: Here are the top opportunities for NVDA:

1. Cash-Secured Put - $115 strike, Feb 21 expiry
   Premium: $2.45 | Delta: 0.22 | IV: 58%
   Return if OTM: 2.1% (25% annualized)

2. Cash-Secured Put - $110 strike, Feb 21 expiry
   Premium: $1.85 | Delta: 0.18 | IV: 55%
   Return if OTM: 1.7% (21% annualized)
```

**Calculation Request:**
```
User: Calculate a CSP on AMD at $120 strike, $2.50 premium

ClawBot: Cash-Secured Put Analysis:
- Strike: $120
- Premium: $2.50/share
- Collateral Required: $12,000
- Max Profit: $250 (2.08% return)
- Break-even: $117.50
- If Assigned: Buy 100 shares at effective cost of $117.50
```
