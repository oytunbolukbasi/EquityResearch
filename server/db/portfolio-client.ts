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
}

export interface PortfolioClosedPositionRow {
  symbol: string
  buyPrice: number
  sellPrice: number
  quantity: number
  pl: number
  plPercent: number
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

export const portfolioRepo = {
  async getOpenPositions(): Promise<PortfolioPositionRow[]> {
    const rows = await sql`
      SELECT id, symbol, name, type, quantity, buy_price, buy_date, current_price, buy_rate
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
      buyDate: r.buy_date as string,
      currentPrice: toNumOrNull(r.current_price),
      buyRate: toNumOrNull(r.buy_rate),
    }))
  },

  async getClosedPositions(): Promise<PortfolioClosedPositionRow[]> {
    const rows = await sql`
      SELECT symbol, buy_price, sell_price, quantity, pl, pl_percent, sell_date
      FROM closed_positions
      ORDER BY sell_date DESC
    `
    return rows.map((r) => ({
      symbol: r.symbol as string,
      buyPrice: toNum(r.buy_price),
      sellPrice: toNum(r.sell_price),
      quantity: toNum(r.quantity),
      pl: toNum(r.pl),
      plPercent: toNum(r.pl_percent),
      sellDate: r.sell_date as string,
    }))
  },
}
