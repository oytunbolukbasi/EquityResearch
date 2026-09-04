import type { PortfolioClosedPosition, PortfolioPosition } from '@/lib/api-types'

/**
 * Everything the Analiz tab reports, in lira.
 *
 * ── Which exchange rate? ────────────────────────────────────────────────────
 * The app this replaces converted a US position's cost at *today's* rate, which
 * strips the currency move out and measures only the share's own performance.
 * EQR converts at the rate on the purchase date (`buyRate`), which is what
 * actually left the account — so the return includes the currency move.
 *
 * The two answer different questions and differ materially (23.480 TL on the
 * live portfolio the day this was written). Rather than pick one and hide the
 * other, the total is reported EQR's way and then split, because it decomposes
 * exactly:
 *
 *   qty × (curPx × liveRate − buyPx × buyRate)
 *     = qty × (curPx − buyPx) × liveRate      ← the share moved  (old app's figure)
 *     + qty × buyPx × (liveRate − buyRate)    ← the currency moved
 *
 * TRY positions have no second term, so for them the split is a no-op.
 */

export interface Bucket {
  value: number
  cost: number
  pl: number
  plPercent: number
}

export interface Analytics {
  /** Open positions, converted at the live rate. */
  totalValue: number
  totalCost: number
  unrealized: number
  unrealizedPercent: number
  /** `unrealized` split into its two causes. Sums back to `unrealized`. */
  fromShares: number
  fromCurrency: number

  /** Closed positions, all time. */
  realizedLifetime: number
  /** Closed positions whose sale falls inside the selected range. */
  realizedPeriod: number
  periodCount: number

  /** realized (lifetime) + unrealized, over cost of everything ever held. */
  net: number
  netPercent: number

  /** Counts — trade record rather than money. */
  openCount: number
  closedCountLifetime: number
  closedCountPeriod: number
  winners: number
  losers: number
  /** Winners as a share of decided trades, null until at least one is closed. */
  winRate: number | null

  byType: { key: string; label: string; bucket: Bucket; share: number }[]
}

const TYPE_LABELS: [string, string][] = [
  ['stock', 'BİST hissesi'],
  ['us_stock', 'ABD hissesi'],
  ['fund', 'Yatırım fonu'],
]

function bucketOf(positions: PortfolioPosition[], liveRate: number): Bucket {
  let value = 0
  let cost = 0
  for (const p of positions) {
    const isUs = p.type === 'us_stock'
    const rate = isUs ? liveRate : 1
    const buyRate = isUs ? (p.buyRate ?? liveRate) : 1
    value += p.quantity * (p.currentPrice ?? p.buyPrice) * rate
    cost += p.quantity * p.buyPrice * buyRate
  }
  const pl = value - cost
  return { value, cost, pl, plPercent: cost > 0 ? (pl / cost) * 100 : 0 }
}

/**
 * `from`/`to` are ISO dates (inclusive) filtering closed positions by sale
 * date; null means all time.
 */
export function computeAnalytics(
  positions: PortfolioPosition[],
  closed: PortfolioClosedPosition[],
  liveRate: number,
  range: { from: string | null; to: string | null },
): Analytics {
  const open = bucketOf(positions, liveRate)

  let fromShares = 0
  let fromCurrency = 0
  for (const p of positions) {
    const isUs = p.type === 'us_stock'
    const rate = isUs ? liveRate : 1
    const buyRate = isUs ? (p.buyRate ?? liveRate) : 1
    fromShares += p.quantity * ((p.currentPrice ?? p.buyPrice) - p.buyPrice) * rate
    fromCurrency += p.quantity * p.buyPrice * (rate - buyRate)
  }

  // Closed rows carry the purchase rate but no sale-date rate, so a US sale is
  // valued at today's rate. Exact for TRY holdings, an approximation for US
  // ones — surfaced as a footnote in the UI rather than hidden.
  const realizedOf = (rows: PortfolioClosedPosition[]) =>
    rows.reduce((sum, c) => sum + (c.type === 'us_stock' ? c.pl * liveRate : c.pl), 0)

  const inRange = closed.filter((c) => {
    const day = c.sellDate.slice(0, 10)
    if (range.from && day < range.from) return false
    if (range.to && day > range.to) return false
    return true
  })

  const realizedLifetime = realizedOf(closed)
  const realizedPeriod = realizedOf(inRange)

  // Cost of everything ever held, so the net percentage has a denominator that
  // includes positions already sold.
  const closedCost = closed.reduce(
    (sum, c) => sum + c.quantity * c.buyPrice * (c.type === 'us_stock' ? liveRate : 1),
    0,
  )
  const lifetimeCost = open.cost + closedCost
  const net = realizedLifetime + open.pl

  const byType = TYPE_LABELS.map(([key, label]) => ({
    key,
    label,
    bucket: bucketOf(
      positions.filter((p) => p.type === key),
      liveRate,
    ),
    share: 0,
  })).filter((t) => t.bucket.value > 0)

  for (const t of byType) {
    t.share = open.value > 0 ? (t.bucket.value / open.value) * 100 : 0
  }

  // Win/loss is counted over the selected range so the record can be read for
  // a period, not only for all time.
  const winners = inRange.filter((c) => c.pl > 0).length
  const losers = inRange.filter((c) => c.pl < 0).length
  const decided = winners + losers

  return {
    totalValue: open.value,
    totalCost: open.cost,
    unrealized: open.pl,
    unrealizedPercent: open.plPercent,
    fromShares,
    fromCurrency,
    realizedLifetime,
    realizedPeriod,
    periodCount: inRange.length,
    net,
    netPercent: lifetimeCost > 0 ? (net / lifetimeCost) * 100 : 0,
    openCount: positions.length,
    closedCountLifetime: closed.length,
    closedCountPeriod: inRange.length,
    winners,
    losers,
    // Break-even trades are excluded from the denominator: they decided
    // nothing either way.
    winRate: decided > 0 ? (winners / decided) * 100 : null,
    byType,
  }
}
