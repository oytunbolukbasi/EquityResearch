import { useApi } from './use-api'

/**
 * The ~15-minute-delayed price for plan tickers, from the same sheet the
 * portfolio reads (GET /api/trade-plans/live-prices).
 *
 * Kept distinct from `TradePlan.currentPrice` on purpose: that one is what the
 * last content round wrote — normally the previous close — and it is also where
 * the chart's last bar ends. Showing both under one name was the confusion this
 * exists to remove.
 */
export interface LivePrices {
  prices: Record<string, number>
  /** When the sheet was actually read; a cache hit carries the original time. */
  readAt: string | null
  /** True when the sheet didn't answer and these are the last prices it gave. */
  stale: boolean
}

export function useLivePrices() {
  return useApi<LivePrices>('/api/trade-plans/live-prices')
}

/** "18:25" — the time a price was read, in the reader's own clock. */
export function fmtClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

/** "18 Eyl" from a bar's 'YYYY-MM-DD' — text-sliced, no timezone round-trip. */
export function fmtBarDay(t: string | null | undefined): string {
  if (!t) return '—'
  const [y, m, d] = t.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}
