import { askAI, analyzeOpportunity, answerTradingQuestion } from '../lib/ai.js'
import { getTickerNews, getWatchlistNews } from '../data/earnings.js'
import { getScanResults } from '../scheduler.js'
import { getWatchlist } from './watchlist.js'
import { bold, bullets } from '../lib/format.js'

export default {
  name: 'ask',
  match: async ({ isAdminChannel, text }) => 
    isAdminChannel && (
      text.startsWith('!ask ') || 
      text.startsWith('!analyze ') ||
      text.startsWith('!news ')
    ),

  run: async ({ message, textRaw, log }) => {
    const parts = textRaw.trim().split(/\s+/)
    const command = parts[0].toLowerCase()

    // !ask <question> - general AI questions
    if (command === '!ask') {
      const question = textRaw.slice(5).trim()
      if (!question) {
        return message.reply('Usage: `!ask <your question>`\nExample: `!ask What are the best puts to sell today?`')
      }

      await message.reply('🤔 Thinking...')
      
      try {
        const watchlist = getWatchlist()
        const opportunities = getScanResults().slice(0, 5)
        
        const context = {
          watchlist: watchlist.join(', '),
          topOpportunities: opportunities.map(o => 
            `${o.ticker} ${o.strategy} ${o.expiry} $${o.strike} (IV: ${o.iv}%)`
          ).join('; ') || 'No scan results yet'
        }

        const answer = await answerTradingQuestion(question, context)
        return message.reply(answer)
      } catch (err) {
        console.error('AI error:', err)
        return message.reply(`❌ AI error: ${err.message}`)
      }
    }

    // !analyze <ticker> - AI analysis of a specific ticker's opportunities
    if (command === '!analyze') {
      const ticker = parts[1]?.toUpperCase()
      if (!ticker) {
        return message.reply('Usage: `!analyze TICKER`\nExample: `!analyze NVDA`')
      }

      await message.reply(`🔍 Analyzing ${ticker}...`)

      try {
        // Get opportunities for this ticker
        const opportunities = getScanResults().filter(o => o.ticker === ticker)
        
        // Get news
        const news = await getTickerNews(ticker, 3)
        const newsContext = news.length > 0 
          ? news.map(n => n.title).join('; ')
          : 'No recent news'

        if (opportunities.length === 0) {
          // No scan results, do general analysis
          const analysis = await askAI(
            `Provide a brief options trading outlook for ${ticker}. Recent news: ${newsContext}. What strategies might work?`,
            'You are an expert options trader. Be concise (under 150 words). Focus on actionable insights.'
          )
          
          return message.reply(`**${ticker} Analysis**\n\n${analysis}\n\n📰 **News:** ${news.length > 0 ? news.map(n => `• ${n.title}`).join('\n') : 'No recent news'}`)
        }

        // Analyze the best opportunity
        const best = opportunities[0]
        const analysis = await analyzeOpportunity(best, { news: newsContext })

        const out = [
          bold(`${ticker} Analysis`),
          '',
          `**Best Opportunity:** ${best.strategy}`,
          `Strike: $${best.strike} | Exp: ${best.expiry}`,
          `Premium: $${best.mid} | IV: ${best.iv}% | Delta: ${best.delta}`,
          '',
          '**AI Assessment:**',
          analysis,
          '',
          news.length > 0 ? '📰 **Recent News:**' : '',
          ...news.slice(0, 3).map(n => `• ${n.title}`)
        ].filter(Boolean).join('\n')

        return message.reply(out)
      } catch (err) {
        console.error('Analysis error:', err)
        return message.reply(`❌ Error: ${err.message}`)
      }
    }

    // !news [ticker] - get news for ticker or watchlist
    if (command === '!news') {
      const ticker = parts[1]?.toUpperCase()

      try {
        if (ticker) {
          // News for specific ticker
          await message.reply(`📰 Fetching news for ${ticker}...`)
          const news = await getTickerNews(ticker, 5)
          
          if (news.length === 0) {
            return message.reply(`No recent news found for ${ticker}`)
          }

          const out = [
            bold(`${ticker} News`),
            '',
            ...news.map(n => 
              `• **${n.title}**\n  ${n.source} • ${new Date(n.published).toLocaleDateString()}`
            )
          ].join('\n')

          return message.reply(out)
        } else {
          // News for watchlist
          const watchlist = getWatchlist()
          await message.reply(`📰 Fetching news for watchlist (${watchlist.join(', ')})...`)
          
          const news = await getWatchlistNews(watchlist, 2)
          
          if (news.length === 0) {
            return message.reply('No recent news found')
          }

          const out = [
            bold('Watchlist News'),
            '',
            ...news.slice(0, 10).map(n => 
              `• **[${n.ticker}]** ${n.title}\n  ${n.source} • ${new Date(n.published).toLocaleDateString()}`
            )
          ].join('\n')

          return message.reply(out)
        }
      } catch (err) {
        console.error('News error:', err)
        return message.reply(`❌ Error: ${err.message}`)
      }
    }
  }
}
