import { scanOptions } from '../data/optionsScanner.js'
import { getWatchlist } from './watchlist.js'
import { bullets, bold } from '../lib/format.js'

export async function buildWeeklyReport() {
  const tickers = getWatchlist()
  const rows = await scanOptions({ tickers, mode: 'weekly' })
  const top = rows.slice(0, 12)

  const lines = [
    `📈 ${bold('Weekly Options Review')} — ${new Date().toLocaleDateString('en-US')}`,
    `Universe: ${tickers.join(', ')}`,
    '',
    bold('Top Setups'),
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

  lines.push(bold('Notes'), bullets([
    'This is placeholder data until a market data provider is wired in.',
    'Next: add liquidity + earnings filters + real greeks.'
  ]))

  return lines.join('\n')
}

export default {
  name: 'weekly',
  match: async ({ isAdminChannel, text }) => isAdminChannel && text === '!weekly',
  run: async ({ message, postOptions, log }) => {
    await log(`📣 Posting weekly report requested by <@${message.author.id}>`)
    const report = await buildWeeklyReport()
    await postOptions(report)
    await message.reply('✅ Posted weekly report to #moltbot-options')
  }
}
