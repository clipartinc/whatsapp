import { scanOptions } from '../data/optionsScanner.js'
import { getWatchlist } from './watchlist.js'
import { bullets, bold } from '../lib/format.js'

export default {
  name: 'scan',
  match: async ({ isAdminChannel, text }) => isAdminChannel && text === '!scan',
  run: async ({ message, log }) => {
    const tickers = getWatchlist()
    await log(`🔎 Manual scan requested by <@${message.author.id}>: ${tickers.join(', ')}`)

    const rows = await scanOptions({ tickers, mode: 'daily' })
    const top = rows.slice(0, 5)

    const out = [
      bold('Top Scan Results (preview)'),
      ...top.map((r, idx) => (
        `${idx + 1}) **${r.ticker}** — ${r.strategy}\n` +
        bullets([
          `Exp: ${r.expiry} | Strike: ${r.strike}`,
          `Mid: $${r.mid} | Delta: ${r.delta} | IV Rank: ${r.ivRank}`,
          `OI: ${r.oi} | Spread: ${r.spreadPct}%`
        ])
      ))
    ].join('\n\n')

    await message.reply(out)
  }
}
