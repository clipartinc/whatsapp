import cron from 'node-cron'

export function startScheduler({ client, CONFIG, runDaily, runWeekly, log }) {
  // Run once on boot (optional): comment out if you don’t want it
  // runDaily().catch(() => {})

  cron.schedule(CONFIG.schedule.daily, async () => {
    await log(`⏰ Running daily scan...`)
    await runDaily()
  }, { timezone: CONFIG.timezone })

  cron.schedule(CONFIG.schedule.weekly, async () => {
    await log(`⏰ Running weekly review...`)
    await runWeekly()
  }, { timezone: CONFIG.timezone })

  return true
}
