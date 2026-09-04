import { refreshFundPrices, refreshSharePrices } from './price-refresh'

/**
 * Two schedules, because the two price sources cost very different amounts.
 *
 *  - Shares (BIST + US) come from the Google Sheet in one cheap request, and
 *    the sheet itself is ~15 minutes delayed. Polling it every 15 minutes
 *    matches the data's own resolution and keeps the panel close to live.
 *  - Funds (TEFAS) are scraped one page at a time through a metered ScraperAPI
 *    quota, and a fund price only changes once a day. Those run twice on
 *    weekday mornings, in the window TEFAS publishes the previous day's prices,
 *    and never on startup — a redeploy loop would otherwise eat the quota.
 *
 * This mirrors what the PortfoyTakip app did. Collapsing both onto one morning
 * schedule (an earlier version of this file did) would have quietly dropped
 * share prices from 15-minute freshness to twice a day.
 *
 * Deliberately not node-cron: "every 15 minutes" is a timer, and "weekday
 * mornings on the hour in one fixed timezone" is a minute-tick plus two
 * comparisons. Neither is worth a dependency here.
 */

const SHARE_INTERVAL_MS = 15 * 60 * 1000
const FUND_HOURS_TR = [9, 10]
const TICK_MS = 60_000

/** Turkey is UTC+3 all year, so a fixed offset is exact — no DST to track. */
function turkishNow(): Date {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
}

/**
 * The fund-schedule decision, split out and pure so it can be checked against
 * known timestamps rather than by waiting for 09:00 to come around. Returns the
 * slot id to run, or null to stay idle. `now` must already be Turkish time.
 */
export function dueSlot(now: Date): string | null {
  const day = now.getUTCDay() // 0 Sunday … 6 Saturday
  if (day === 0 || day === 6) return null
  if (!FUND_HOURS_TR.includes(now.getUTCHours())) return null
  if (now.getUTCMinutes() !== 0) return null
  return `${now.toISOString().slice(0, 10)}:${now.getUTCHours()}`
}

/** Marks the slot already handled, so a restart can't re-run the same hour. */
let lastFundSlot: string | null = null

async function runShares() {
  try {
    const { updated, skipped } = await refreshSharePrices(true)
    if (skipped.length) {
      console.log(
        `[price] ${updated.length} hisse güncellendi, ${skipped.length} atlandı: ` +
          skipped.map((s) => s.symbol).join(', '),
      )
    }
  } catch (e) {
    console.error('[price] share refresh failed —', e)
  }
}

async function fundTick() {
  const slot = dueSlot(turkishNow())
  if (!slot || slot === lastFundSlot) return
  lastFundSlot = slot

  console.log(`[price] ${slot} — fon fiyatları çekiliyor`)
  try {
    const { updated, skipped } = await refreshFundPrices(true)
    console.log(
      `[price] ${updated.length} fon güncellendi` +
        (skipped.length ? `, ${skipped.length} atlandı: ${skipped.map((s) => s.symbol).join(', ')}` : ''),
    )
  } catch (e) {
    console.error('[price] fund refresh failed —', e)
  }
}

export function startPriceScheduler() {
  if (!process.env.SHEETS_PRICE_URL) {
    console.warn('[price] SHEETS_PRICE_URL not set — scheduler idle.')
    return
  }

  // Shares refresh right away so a redeploy doesn't leave the panel showing
  // whatever was on screen 15 minutes ago.
  void runShares()
  setInterval(() => void runShares(), SHARE_INTERVAL_MS).unref()

  // Funds deliberately do NOT run on startup — quota protection.
  setInterval(() => void fundTick(), TICK_MS).unref()

  console.log(
    '[price] hisseler 15 dk arayla; fonlar hafta içi 09:00 ve 10:00 (TR) — açılışta fon çekilmez.',
  )
}
