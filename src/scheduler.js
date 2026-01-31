import cron from 'node-cron'
import { scanOptions } from './data/optionsScanner.js'
import { getWatchlist } from './skills/watchlist.js'

// Store accumulated scan results
const scanState = {
  results: [],
  currentIndex: 0,
  isScanning: false
}

export function getScanResults() {
  return [...scanState.results]
}

export function clearScanResults() {
  scanState.results = []
  scanState.currentIndex = 0
}

export function startScheduler({ client, CONFIG, runDaily, runWeekly, log }) {
  const BATCH_SIZE = 4

  // Run batch scanner every minute during market hours (Mon-Fri, 8am-4pm)
  cron.schedule('* 8-16 * * 1-5', async () => {
    if (scanState.isScanning) return

    const tickers = getWatchlist()
    if (tickers.length === 0) return

    // Get next batch of tickers
    const start = scanState.currentIndex
    const batch = tickers.slice(start, start + BATCH_SIZE)

    if (batch.length === 0) {
      // Finished full cycle, reset for next round
      scanState.currentIndex = 0
      return
    }

    scanState.isScanning = true
    try {
      console.log(`🔄 Scanning batch: ${batch.join(', ')}`)
      const results = await scanOptions({ tickers: batch, mode: 'daily' })
      
      // Add new results, avoiding duplicates by ticker
      for (const r of results) {
        const existing = scanState.results.findIndex(x => x.ticker === r.ticker && x.strike === r.strike)
        if (existing >= 0) {
          scanState.results[existing] = r // Update with fresher data
        } else {
          scanState.results.push(r)
        }
      }

      // Sort by score
      scanState.results.sort((a, b) => b.score - a.score)
      // Keep top 50
      scanState.results = scanState.results.slice(0, 50)

      scanState.currentIndex += BATCH_SIZE
    } catch (err) {
      console.error('Batch scan error:', err.message)
    } finally {
      scanState.isScanning = false
    }
  }, { timezone: CONFIG.timezone })

  // Daily report at scheduled time
  cron.schedule(CONFIG.schedule.daily, async () => {
    await log(`⏰ Running daily scan...`)
    await runDaily()
    // Clear accumulated results after posting
    clearScanResults()
  }, { timezone: CONFIG.timezone })

  // Weekly report at scheduled time
  cron.schedule(CONFIG.schedule.weekly, async () => {
    await log(`⏰ Running weekly review...`)
    await runWeekly()
  }, { timezone: CONFIG.timezone })

  return true
}
