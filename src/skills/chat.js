import { answerTradingQuestion } from '../lib/ai.js'
import { getScanResults } from '../scheduler.js'
import { getWatchlist } from './watchlist.js'

export default {
  name: 'chat',
  // Match any message in admin channel that doesn't start with !
  match: async ({ isAdminChannel, text }) => {
    if (!isAdminChannel) return false
    if (text.startsWith('!')) return false
    if (text === 'ping') return false
    // Only respond to messages that look like questions or requests
    return text.length > 3
  },

  run: async ({ message, textRaw, log }) => {
    const question = textRaw.trim()
    
    // Show typing indicator
    await message.channel.sendTyping()
    
    try {
      const watchlist = getWatchlist()
      const opportunities = getScanResults().slice(0, 5)
      
      const context = {
        watchlist: watchlist.join(', '),
        topOpportunities: opportunities.length > 0 
          ? opportunities.map(o => 
              `${o.ticker} ${o.strategy} ${o.expiry} $${o.strike} (IV: ${o.iv}%, Delta: ${o.delta})`
            ).join('; ')
          : 'No scan results yet - try !scan or !watchlist auto first'
      }

      const answer = await answerTradingQuestion(question, context)
      
      // Split long responses
      if (answer.length > 1900) {
        const chunks = answer.match(/.{1,1900}/gs) || [answer]
        for (const chunk of chunks) {
          await message.reply(chunk)
        }
      } else {
        await message.reply(answer)
      }
    } catch (err) {
      console.error('Chat error:', err)
      
      if (err.message.includes('OPENAI_API_KEY')) {
        return message.reply('⚠️ AI not configured. Set `OPENAI_API_KEY` in environment variables.\n\nYou can still use commands: `!help`')
      }
      
      return message.reply(`❌ AI error: ${err.message}`)
    }
  }
}
