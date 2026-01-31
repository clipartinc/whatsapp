/**
 * OpenClaw Skill: Options Calculator
 * Calculate profits, break-evens, and position sizing
 * 
 * Usage: "calculate profit on selling a $200 put at $3.50"
 */

/**
 * Calculate cash-secured put metrics
 * @param {number} strike - Strike price
 * @param {number} premium - Premium received per share
 * @param {number} contracts - Number of contracts (default 1)
 */
export function cashSecuredPut(strike, premium, contracts = 1) {
  const shares = contracts * 100
  const totalPremium = premium * shares
  const collateralRequired = strike * shares
  const breakEven = strike - premium
  const maxProfit = totalPremium
  const maxLoss = collateralRequired - totalPremium
  const returnOnCapital = (totalPremium / collateralRequired) * 100

  return {
    strategy: 'Cash-Secured Put',
    strike,
    premium,
    contracts,
    collateralRequired: collateralRequired.toFixed(2),
    maxProfit: maxProfit.toFixed(2),
    maxLoss: maxLoss.toFixed(2),
    breakEven: breakEven.toFixed(2),
    returnOnCapital: returnOnCapital.toFixed(2) + '%',
    scenario: {
      profitIf: `Stock stays above $${breakEven.toFixed(2)} at expiration`,
      assigned: `Buy 100 shares at $${strike} (effective cost: $${breakEven.toFixed(2)})`
    }
  }
}

/**
 * Calculate covered call metrics
 * @param {number} stockPrice - Current stock price (or purchase price)
 * @param {number} strike - Strike price
 * @param {number} premium - Premium received per share
 * @param {number} shares - Number of shares (default 100)
 */
export function coveredCall(stockPrice, strike, premium, shares = 100) {
  const contracts = Math.floor(shares / 100)
  const totalPremium = premium * shares
  const maxProfit = ((strike - stockPrice) * shares) + totalPremium
  const breakEven = stockPrice - premium
  const returnIfCalled = ((strike - stockPrice + premium) / stockPrice) * 100
  const returnFromPremium = (premium / stockPrice) * 100

  return {
    strategy: 'Covered Call',
    stockPrice,
    strike,
    premium,
    shares,
    totalPremium: totalPremium.toFixed(2),
    maxProfit: maxProfit.toFixed(2),
    breakEven: breakEven.toFixed(2),
    returnIfCalled: returnIfCalled.toFixed(2) + '%',
    returnFromPremium: returnFromPremium.toFixed(2) + '%',
    scenario: {
      calledAway: `Sell shares at $${strike}, total return: ${returnIfCalled.toFixed(2)}%`,
      keepShares: `Stock below $${strike}, keep premium ($${totalPremium.toFixed(2)})`
    }
  }
}

/**
 * Calculate position size based on risk
 * @param {number} accountSize - Total account value
 * @param {number} riskPercent - Max risk per trade (e.g., 2 for 2%)
 * @param {number} strike - Strike price for CSP
 */
export function positionSize(accountSize, riskPercent, strike) {
  const maxRiskDollars = accountSize * (riskPercent / 100)
  const collateralPerContract = strike * 100
  const maxContracts = Math.floor(maxRiskDollars / collateralPerContract)
  const actualRisk = (maxContracts * collateralPerContract / accountSize) * 100

  return {
    accountSize,
    maxRiskPercent: riskPercent + '%',
    maxRiskDollars: maxRiskDollars.toFixed(2),
    strike,
    collateralPerContract: collateralPerContract.toFixed(2),
    recommendedContracts: maxContracts,
    actualCapitalUsed: (maxContracts * collateralPerContract).toFixed(2),
    actualRiskPercent: actualRisk.toFixed(2) + '%'
  }
}

/**
 * Annualize a return
 * @param {number} returnPercent - Return percentage
 * @param {number} days - Days to expiration
 */
export function annualizeReturn(returnPercent, days) {
  const annualized = (returnPercent / days) * 365
  return {
    returnPercent: returnPercent.toFixed(2) + '%',
    days,
    annualizedReturn: annualized.toFixed(2) + '%'
  }
}

/**
 * Calculate wheel strategy metrics
 * @param {number} strike - Strike price
 * @param {number} putPremium - Premium from selling put
 * @param {number} callPremium - Premium from selling call (if assigned)
 */
export function wheelStrategy(strike, putPremium, callPremium = 0) {
  const costBasis = strike - putPremium
  const totalPremium = putPremium + callPremium
  const effectiveCost = strike - totalPremium
  
  return {
    strategy: 'Wheel Strategy',
    strike,
    putPremium,
    callPremium,
    costBasisIfAssigned: costBasis.toFixed(2),
    totalPremiumCollected: totalPremium.toFixed(2),
    effectiveCostBasis: effectiveCost.toFixed(2),
    steps: [
      `1. Sell CSP at $${strike} strike, collect $${putPremium} premium`,
      `2. If assigned, cost basis = $${costBasis.toFixed(2)}`,
      `3. Sell covered call, collect additional premium`,
      `4. If called away, profit from premium + any stock appreciation`
    ]
  }
}
