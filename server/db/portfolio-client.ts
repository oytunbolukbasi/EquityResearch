import { neon } from '@neondatabase/serverless'

/**
 * READ-ONLY access to the separate portfolio-tracker database.
 *
 * That app (not this one) owns positions/closed_positions/current_price —
 * writing to it here would corrupt data another service depends on. To keep
 * that a structural guarantee rather than a convention:
 *
 *   - The `sql` tagged-template client below is NOT exported. It never
 *     leaves this module.
 *   - The only way to touch the portfolio DB from the rest of the app is
 *     through `portfolioRepo`, and every function on it is a hand-written
 *     SELECT. There is no insert/update/delete method to reach for by
 *     mistake, and no generic `query(sql)` escape hatch either.
 *
 * If a future portfolio_write need ever comes up, it must go through a
 * different, explicitly-named module — never add a write method here.
 */

const portfolioDatabaseUrl = process.env.PORTFOLIO_DATABASE_URL
if (!portfolioDatabaseUrl) {
  throw new Error('PORTFOLIO_DATABASE_URL is not set — copy .env.example to .env and fill it in.')
}

const sql = neon(portfolioDatabaseUrl)

export interface PortfolioPositionRow {
  id: string
  symbol: string
  name: string | null
  type: string
  quantity: number
  buyPrice: number
  buyDate: string
  currentPrice: number | null
  buyRate: number | null
  /** When current_price was last written — surfaces stale prices in the UI. */
  lastUpdated: string | null
}

export interface PortfolioClosedPositionRow {
  /** Needed so the Sanal Portföy tab can delete a mistaken sale record. */
  id: string
  symbol: string
  name: string | null
  type: string
  buyPrice: number
  sellPrice: number
  quantity: number
  pl: number
  plPercent: number
  buyDate: string
  sellDate: string
}

// numeric columns come back from Postgres as strings (to avoid silent
// precision loss) — the app only ever displays/adds these, so plain floats
// are fine and much easier for the widgets to consume as JSON.
function toNum(v: unknown): number {
  return v == null ? 0 : Number(v)
}
function toNumOrNull(v: unknown): number | null {
  return v == null ? null : Number(v)
}

/**
 * Postgres `timestamp` columns (no time zone) come back as
 * "2026-09-04 10:02:31.90756". The value is UTC, but with no marker saying so
 * the browser's Date.parse reads it as local time — which made a price
 * refreshed seconds ago look three hours stale in Turkey. Normalise to a real
 * ISO-8601 UTC string here, where the column's semantics are known.
 */
function toIsoUtc(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    // The driver parsed a zone-less value in the process's LOCAL timezone, so
    // its local components are the stored ones. toISOString() would re-anchor
    // them and shift the wall clock — three hours in Turkey, which was enough
    // to show a purchase made on the 18th as the 17th.
    const p = (n: number, w = 2) => String(n).padStart(w, '0')
    return (
      `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}` +
      `T${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}.${p(v.getMilliseconds(), 3)}Z`
    )
  }
  const s = String(v)
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return s // already carries an offset
  return `${s.replace(' ', 'T')}Z`
}

export const portfolioRepo = {
  async getOpenPositions(): Promise<PortfolioPositionRow[]> {
    const rows = await sql`
      SELECT id, symbol, name, type, quantity, buy_price, buy_date, current_price, buy_rate,
             last_updated
      FROM positions
      ORDER BY symbol
    `
    return rows.map((r) => ({
      id: String(r.id),
      symbol: r.symbol as string,
      name: (r.name as string | null) ?? null,
      type: r.type as string,
      quantity: toNum(r.quantity),
      buyPrice: toNum(r.buy_price),
      buyDate: toIsoUtc(r.buy_date) ?? '',
      currentPrice: toNumOrNull(r.current_price),
      buyRate: toNumOrNull(r.buy_rate),
      lastUpdated: toIsoUtc(r.last_updated),
    }))
  },

  async getClosedPositions(): Promise<PortfolioClosedPositionRow[]> {
    const rows = await sql`
      SELECT id, symbol, name, type, buy_price, sell_price, quantity,
             pl, pl_percent, buy_date, sell_date
      FROM closed_positions
      ORDER BY sell_date DESC
    `
    return rows.map((r) => ({
      id: String(r.id),
      symbol: r.symbol as string,
      name: (r.name as string | null) ?? null,
      type: r.type as string,
      buyPrice: toNum(r.buy_price),
      sellPrice: toNum(r.sell_price),
      quantity: toNum(r.quantity),
      pl: toNum(r.pl),
      plPercent: toNum(r.pl_percent),
      buyDate: toIsoUtc(r.buy_date) ?? '',
      sellDate: toIsoUtc(r.sell_date) ?? '',
    }))
  },
}
