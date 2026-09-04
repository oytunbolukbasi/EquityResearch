import type { PortfolioPosition, PortfolioSummary } from '@/lib/api-types'

export interface Bucket {
  costBasis: number
  currentValue: number | null
  plAmount: number | null
  plPercent: number | null
}

function bucket(
  positions: PortfolioPosition[],
  cost: (p: PortfolioPosition) => number,
  value: (p: PortfolioPosition) => number | null,
): Bucket {
  const costBasis = positions.reduce((s, p) => s + cost(p), 0)
  // A single missing price makes the whole total wrong rather than merely
  // incomplete, so the bucket reports null instead of a silently short sum.
  const complete = positions.every((p) => value(p) != null)
  const currentValue = complete ? positions.reduce((s, p) => s + (value(p) ?? 0), 0) : null
  const plAmount = currentValue != null ? currentValue - costBasis : null
  const plPercent = plAmount != null && costBasis !== 0 ? (plAmount / costBasis) * 100 : null
  return { costBasis, currentValue, plAmount, plPercent }
}

export interface PortfolioTotals {
  tl: Bucket
  usd: Bucket
  total: Bucket
  tlPositions: PortfolioPosition[]
  usdPositions: PortfolioPosition[]
  rateLabel: string | null
}

/**
 * TL bucket = TRY-denominated stocks and funds at face value.
 * USD bucket = US stocks converted with the live USD/TRY rate (the API already
 * supplies costBasisTRY / currentValueTRY), so `total` is comparable in lira.
 */
export function computeTotals(summary: PortfolioSummary | null): PortfolioTotals {
  const positions = summary?.positions ?? []
  const tlPositions = positions.filter((p) => p.type === 'stock' || p.type === 'fund')
  const usdPositions = positions.filter((p) => p.type === 'us_stock')

  const tl = bucket(
    tlPositions,
    (p) => p.costBasis,
    (p) => p.currentValue,
  )
  const usd = bucket(
    usdPositions,
    (p) => p.costBasisTRY ?? 0,
    (p) => p.currentValueTRY,
  )
  const total = bucket(
    positions,
    (p) => (p.type === 'us_stock' ? (p.costBasisTRY ?? 0) : p.costBasis),
    (p) => (p.type === 'us_stock' ? p.currentValueTRY : p.currentValue),
  )

  const rateLabel = summary
    ? summary.usdTryRateIsFallback
      ? `Kur ≈ ${fmtN(summary.usdTryRate, 2)} (tahmini)`
      : `Kur: ${fmtN(summary.usdTryRate, 2)}`
    : null

  return { tl, usd, total, tlPositions, usdPositions, rateLabel }
}

export function fmtN(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** `₺1.295.784` / `$187,62` / bare number for funds. */
export function fmtMoney(n: number | null | undefined, unit: '₺' | '$' | '' = '', decimals = 2) {
  if (n == null) return '—'
  return `${unit}${fmtN(n, decimals)}`
}

export function fmtSignedMoney(n: number | null | undefined, unit: '₺' | '$' | '' = '', decimals = 0) {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : '−'}${unit}${fmtN(Math.abs(n), decimals)}`
}

/**
 * Share counts, which are not always whole: the live portfolio holds 6.11 of
 * one position and 0.809883524 of another. Rounding those to 0 decimals showed
 * "6" and "1" — the second one not just imprecise but wrong by 24%. Shows up to
 * 4 decimals and drops trailing zeros, so 1000 still reads as "1.000".
 */
export function fmtQty(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : '−'}%${fmtN(Math.abs(n), 2)}`
}

export function plColor(n: number | null | undefined): string {
  if (n == null) return 'var(--mid)'
  return n >= 0 ? 'var(--up)' : 'var(--down)'
}

/**
 * Turkish funds are priced in lira just like BIST shares, so they carry the
 * same symbol — leaving them bare made a fund's value read as unitless next to
 * ₺ and $ rows.
 */
export const UNIT_FOR_TYPE: Record<string, '₺' | '$' | ''> = {
  stock: '₺',
  fund: '₺',
  us_stock: '$',
}
