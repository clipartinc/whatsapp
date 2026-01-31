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

  if (top.length === 0) {
    lines.push('⚠️ No data available. Check POLYGON_API_KEY is set.')
    return lines.join('\n')
  }

  top.forEach((r, i) => {
    lines.push(
      `${i + 1}) **${r.ticker}** — ${r.strategy}`,
      bullets([
        `Exp: ${r.expiry} | Strike: $${r.strike}`,
        `Mid: $${r.mid} | Delta: ${r.delta} | IV: ${r.iv}%`,
        `OI: ${r.oi} | Spread: ${r.spreadPct}%`,
        `Why: ${r.why.slice(0, 2).join(' / ')}`
      ]),
      ''
    )
  })

  lines.push(bold('Notes'), bullets([
    'Scans OTM options with 15-35 delta, good liquidity (OI 100+, spread <10%)',
    'Weekly: 3-14 DTE | Daily: 20-45 DTE'
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
