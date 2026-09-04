import { refreshAllPrices } from './price-refresh'

/**
 * Runs the price refresh on weekday mornings, Turkey time.
 *
 * 09:00 and 10:00 mirror what the PortfoyTakip app did: TEFAS publishes the
 * previous day's fund prices in that window, and running twice covers a late
 * publish without spending more of the ScraperAPI quota than necessary.
 *
 * Deliberately not node-cron. The rule is "on the hour, weekday mornings, in
 * one fixed timezone", which is a minute-tick and two comparisons — not worth a
 * dependency in a server that currently has almost none.
 */

const RUN_HOURS_TR = [9, 10]
const TICK_MS = 60_000

/** Turkey is UTC+3 all year, so a fixed offset is exact — no DST to track. */
function turkishNow(): Date {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}

/** Marks the slot already handled, so a restart can't re-run the same hour. */
let lastRunSlot: string | null = null

async function tick() {
  const tr = turkishNow()
  const day = tr.getUTCDay() // 0 Sunday … 6 Saturday
  if (day === 0 || day === 6) return
  if (!RUN_HOURS_TR.includes(tr.getUTCHours())) return
  if (tr.getUTCMinutes() !== 0) return

  const slot = `${tr.toISOString().slice(0, 10)}:${tr.getUTCHours()}`
  if (slot === lastRunSlot) return
  lastRunSlot = slot

  console.log(`[price-scheduler] ${slot} — refreshing prices`)
  try {
    const { updated, skipped } = await refreshAllPrices(true)
    console.log(
      `[price-scheduler] ${updated.length} güncellendi` +
        (skipped.length ? `, ${skipped.length} atlandı: ${skipped.map((s) => s.symbol).join(', ')}` : ''),
    )
  } catch (e) {
    console.error('[price-scheduler] refresh failed —', e)
  }
}

export function startPriceScheduler() {
  if (!process.env.SHEETS_PRICE_URL) {
    console.warn('[price-scheduler] SHEETS_PRICE_URL not set — scheduler idle.')
    return
  }
  // unref() so the timer never holds the process open on shutdown.
  setInterval(tick, TICK_MS).unref()
  console.log('[price-scheduler] active: weekdays 09:00 and 10:00 Turkey time.')
}
