import type { Currency } from '@shared/asset-types'
import {
  CURRENCY_FOR_TYPE,
  POSITION_TYPES,
  UNIT_FOR_CURRENCY,
} from '@shared/asset-types'

/** Every currency symbol the panel can print, plus "no unit". */
export type Unit = (typeof UNIT_FOR_CURRENCY)[Currency] | ''

export function fmtN(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** `₺1.295.784` / `$187,62` / bare number for funds. */
export function fmtMoney(n: number | null | undefined, unit: Unit = '', decimals = 2) {
  if (n == null) return '—'
  return `${unit}${fmtN(n, decimals)}`
}

export function fmtSignedMoney(n: number | null | undefined, unit: Unit = '', decimals = 0) {
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
/** A position's currency symbol, derived from its type. */
export const UNIT_FOR_TYPE: Record<string, Unit> = Object.fromEntries(
  POSITION_TYPES.map((t) => [t, UNIT_FOR_CURRENCY[CURRENCY_FOR_TYPE[t]]]),
)
