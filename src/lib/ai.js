// AI service for analysis and chat
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

export async function askAI(prompt, systemPrompt = '') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set')
  }

  const messages = []
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  
  messages.push({ role: 'user', content: prompt })

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      max_tokens: 1000,
      temperature: 0.7
    })
  })

  if (!resp.ok) {
    const error = await resp.text()
    throw new Error(`OpenAI API error: ${resp.status} ${error}`)
  }

  const data = await resp.json()
  return data.choices[0]?.message?.content || ''
}

// Analyze options opportunities with AI
export async function analyzeOpportunity(opportunity, context = {}) {
  const systemPrompt = `You are an expert options trader assistant. Analyze options opportunities and provide concise, actionable insights. Focus on:
- Risk/reward assessment
- Key factors (IV, delta, liquidity)
- Potential catalysts or risks
- Simple recommendation (bullish/bearish/neutral)
Keep responses under 150 words. Use bullet points.`

  const prompt = `Analyze this options opportunity:

Ticker: ${opportunity.ticker}
Strategy: ${opportunity.strategy}
Expiry: ${opportunity.expiry}
Strike: $${opportunity.strike}
Premium (mid): $${opportunity.mid}
Delta: ${opportunity.delta}
IV: ${opportunity.iv}%
Open Interest: ${opportunity.oi}
Bid/Ask Spread: ${opportunity.spreadPct}%

${context.earnings ? `Earnings: ${context.earnings}` : ''}
${context.news ? `Recent news: ${context.news}` : ''}

Provide a quick analysis and recommendation.`

  return askAI(prompt, systemPrompt)
}

// Answer general trading questions
export async function answerTradingQuestion(question, marketContext = {}) {
  const systemPrompt = `You are an expert options trading assistant for a Discord bot called moltbot. You help users find and analyze options opportunities.

You have access to:
- Options scanner (finds covered calls, cash-secured puts)
- Watchlist of stocks being tracked
- Earnings calendar
- Company news

Be concise (under 200 words). Use Discord markdown formatting (**bold**, \`code\`).
If asked about specific tickers, provide actionable insights.
If you don't have real-time data, say so and suggest using !scan or !daily commands.`

  const contextStr = Object.entries(marketContext)
    .filter(([k, v]) => v)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')

  const prompt = `${contextStr ? `Current context:\n${contextStr}\n\n` : ''}User question: ${question}`

  return askAI(prompt, systemPrompt)
}
