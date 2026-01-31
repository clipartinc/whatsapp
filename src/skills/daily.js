import { scanOptions } from '../data/optionsScanner.js'
import { getWatchlist } from './watchlist.js'
import { bullets, bold } from '../lib/format.js'

export async function buildDailyReport() {
  const tickers = getWatchlist()
  const rows = await scanOptions({ tickers, mode: 'daily' })
  const top = rows.slice(0, 10)

  const lines = [
    `📊 ${bold('Daily Options Scan')} — ${new Date().toLocaleDateString('en-US')}`,
    `Universe: ${tickers.join(', ')}`,
    ''
  ]

  top.forEach((r, i) => {
    lines.push(
      `${i + 1}) **${r.ticker}** — ${r.strategy}`,
      bullets([
        `Exp: ${r.expiry} | Strike: ${r.strike}`,
        `Mid: $${r.mid} | Delta: ${r.delta} | IV Rank: ${r.ivRank}`,
        `OI: ${r.oi} | Spread: ${r.spreadPct}%`,
        `Why: ${r.why.slice(0, 2).join(' / ')}`
      ]),
      ''
    )
  })

  return lines.join('\n')
}

export default {
  name: 'daily',
  match: async ({ isAdminChannel, text }) => isAdminChannel && text === '!daily',
  run: async ({ message, postOptions, log }) => {
    await log(`📣 Posting daily report requested by <@${message.author.id}>`)
    const report = await buildDailyReport()
    await postOptions(report)
    await message.reply('✅ Posted daily report to #moltbot-options')
  }
}
