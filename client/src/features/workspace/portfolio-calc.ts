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
export function fmtQty(n: number | null | undefined, maxDecimals = 4): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

/**
 * How many decimals a type's quantity, price and value deserve.
 *
 * Crypto is the exception the defaults could not carry: holdings run to eight
 * places (0,32831331) and unit prices to four or more (1,4110), so the shared
 * 4-and-2 crop printed numbers nobody had entered — and a 0,142 position value
 * rendered as "$0". Trailing zeros are still dropped, so 24 stays "24".
 */
interface Decimals {
  qty: number
  /** Upper bound on a unit price. */
  price: number
  /** Lower bound — 2 keeps "₺69,60" from collapsing to "₺69,6". */
  priceMin: number
  value: number
  pl: number
}

const DECIMALS: Record<string, Decimals> = {
  crypto: { qty: 8, price: 8, priceMin: 0, value: 2, pl: 2 },
}
const DEFAULT_DECIMALS: Decimals = { qty: 4, price: 2, priceMin: 2, value: 0, pl: 0 }

const decimalsFor = (type: string) => DECIMALS[type] ?? DEFAULT_DECIMALS

/** Quantity, with the precision its asset type is actually held in. */
export const fmtQtyOf = (n: number | null | undefined, type: string) =>
  fmtQty(n, decimalsFor(type).qty)

/** Unit price, with the precision its asset type is actually quoted in. */
export const fmtPriceOf = (n: number | null | undefined, type: string, unit: Unit = '') => {
  if (n == null) return '—'
  const d = decimalsFor(type)
  return `${unit}${n.toLocaleString('tr-TR', {
    minimumFractionDigits: d.priceMin,
    maximumFractionDigits: d.price,
  })}`
}

/**
 * Signed profit and loss. Crypto gets cents: a position worth fourteen cents
 * has a real gain that whole lira rounds to "+$0".
 */
export const fmtPlOf = (n: number | null | undefined, type: string, unit: Unit = '') =>
  fmtSignedMoney(n, unit, decimalsFor(type).pl)

/** Position value — whole lira for shares, cents for crypto. */
export const fmtValueOf = (n: number | null | undefined, type: string, unit: Unit = '') =>
  fmtMoney(n, unit, decimalsFor(type).value)

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

/**
 * One colour per asset group — see --alloc-* in index.css for why it is its own
 * scale, and ASSET_GROUPS for why there are four groups and not five.
 *
 * Lives here so the allocation bar, its legend and the portfolio sections all
 * read the same map: a class must not be blue in one panel and violet in
 * another.
 */
export const GROUP_COLOR: Record<string, string> = {
  tr: 'var(--alloc-1)',
  us: 'var(--alloc-2)',
  de: 'var(--alloc-3)',
  crypto: 'var(--alloc-4)',
}
