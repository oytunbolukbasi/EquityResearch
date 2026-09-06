import type { PortfolioClosedPosition, PortfolioPosition } from '@/lib/api-types'
import {
  ASSET_GROUPS,
  CURRENCY_FOR_TYPE,
  groupOf,
  type AssetGroupId,
  type Currency,
  type PositionType,
} from '@shared/asset-types'

export type Rates = Record<Currency, number>

/** The rate that turns a position's own currency into lira. */
function rateFor(type: string, rates: Rates): number {
  return rates[CURRENCY_FOR_TYPE[type as PositionType] ?? 'TRY'] ?? 1
}

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
  /**
   * `unrealized` split into its two causes. Sums back to `unrealized`.
   *
   * No longer shown in the panel: the split existed to reconcile EQR's figure
   * with the app it replaced, and once that app was retired the two extra rows
   * only raised a question the reader hadn't asked. Kept because
   * `scripts/verify-analytics.ts` uses them as an independent check that the
   * decomposition is exact — if these stop summing to `unrealized`, the
   * exchange-rate handling has drifted.
   */
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
  /**
   * Positions OPENED inside the range — still-open ones plus any already sold
   * again. A position bought and closed in the same month was still opened that
   * month, so counting only the open ones would under-report the activity the
   * period strip is there to summarise.
   */
  openedCountPeriod: number
  winners: number
  losers: number
  /** Winners as a share of decided trades, null until at least one is closed. */
  winRate: number | null

  /**
   * One entry per asset group that actually holds something — the allocation
   * bar, its legend, the KPI cards and the portfolio sections all read this.
   */
  byGroup: { id: AssetGroupId; label: string; bucket: Bucket; share: number }[]

}

function bucketOf(positions: PortfolioPosition[], rates: Rates): Bucket {
  let value = 0
  let cost = 0
  for (const p of positions) {
    const rate = rateFor(p.type, rates)
    // buyRate is the position's own currency on its purchase day; lira
    // positions carry 1, so this line needs no special case for them.
    const buyRate = rate === 1 ? 1 : (p.buyRate ?? rate)
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
  rates: Rates,
  range: { from: string | null; to: string | null },
): Analytics {
  const open = bucketOf(positions, rates)

  let fromShares = 0
  let fromCurrency = 0
  for (const p of positions) {
    const rate = rateFor(p.type, rates)
    const buyRate = rate === 1 ? 1 : (p.buyRate ?? rate)
    fromShares += p.quantity * ((p.currentPrice ?? p.buyPrice) - p.buyPrice) * rate
    fromCurrency += p.quantity * p.buyPrice * (rate - buyRate)
  }

  // Closed rows carry the purchase rate but no sale-date rate, so a US sale is
  // valued at today's rate. Exact for TRY holdings, an approximation for US
  // ones — surfaced as a footnote in the UI rather than hidden.
  const realizedOf = (rows: PortfolioClosedPosition[]) =>
    rows.reduce((sum, c) => sum + c.pl * rateFor(c.type, rates), 0)

  // Dates arrive as 'YYYY-MM-DD...' strings; comparing the day part as text is
  // exact and avoids a timezone round-trip through Date.
  const dayInRange = (stamp: string) => {
    const day = stamp.slice(0, 10)
    if (range.from && day < range.from) return false
    if (range.to && day > range.to) return false
    return true
  }

  const inRange = closed.filter((c) => dayInRange(c.sellDate))
  const openedCountPeriod =
    positions.filter((p) => dayInRange(p.buyDate)).length +
    closed.filter((c) => dayInRange(c.buyDate)).length

  const realizedLifetime = realizedOf(closed)
  const realizedPeriod = realizedOf(inRange)

  // Cost of everything ever held, so the net percentage has a denominator that
  // includes positions already sold.
  const closedCost = closed.reduce(
    (sum, c) => sum + c.quantity * c.buyPrice * rateFor(c.type, rates),
    0,
  )
  const lifetimeCost = open.cost + closedCost
  const net = realizedLifetime + open.pl

  // Groups, not raw types: BİST and funds are reported together — see
  // ASSET_GROUPS for why. A group with nothing in it is not drawn at all.
  const byGroup = ASSET_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    bucket: bucketOf(
      positions.filter((p) => groupOf(p.type) === g.id),
      rates,
    ),
    share: 0,
  })).filter((g) => g.bucket.value > 0)

  for (const g of byGroup) {
    g.share = open.value > 0 ? (g.bucket.value / open.value) * 100 : 0
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
    openedCountPeriod,
    winners,
    losers,
    // Break-even trades are excluded from the denominator: they decided
    // nothing either way.
    winRate: decided > 0 ? (winners / decided) * 100 : null,
    byGroup,
  }
}
