/**
 * OpenClaw Trading Skills
 * 
 * These skills provide options trading capabilities:
 * - Options scanning (find premium-selling opportunities)
 * - Market research (news, company info, quotes)
 * - Options calculations (profit/loss, position sizing)
 * 
 * Setup:
 * 1. Set POLYGON_API_KEY environment variable
 * 2. Copy these files to your OpenClaw workspace
 * 3. The agent can use these functions automatically
 */

export * from './options-scanner.js'
export * from './market-research.js'
export * from './options-calculator.js'

// Skill metadata for OpenClaw
export const skillInfo = {
  name: 'trading-tools',
  version: '1.0.0',
  description: 'Options trading scanner, research, and calculators',
  requires: ['POLYGON_API_KEY'],
  functions: [
    // Options Scanner
    { name: 'scanTicker', description: 'Scan a stock for options opportunities' },
    { name: 'scanMultiple', description: 'Scan multiple tickers at once' },
    
    // Market Research
    { name: 'getNews', description: 'Get recent news for a ticker' },
    { name: 'getCompanyInfo', description: 'Get company details' },
    { name: 'getQuote', description: 'Get current stock quote' },
    { name: 'searchTickers', description: 'Search for stocks by name' },
    { name: 'getMarketMovers', description: 'Get top gainers/losers' },
    
    // Calculators
    { name: 'cashSecuredPut', description: 'Calculate CSP profit/loss' },
    { name: 'coveredCall', description: 'Calculate covered call returns' },
    { name: 'positionSize', description: 'Calculate position size by risk' },
    { name: 'annualizeReturn', description: 'Annualize option returns' },
    { name: 'wheelStrategy', description: 'Calculate wheel strategy metrics' }
  ]
}
