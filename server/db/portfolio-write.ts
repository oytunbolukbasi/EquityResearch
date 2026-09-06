import { neon } from '@neondatabase/serverless'

/**
 * WRITE access to the portfolio-tracker database.
 *
 * Deliberately a separate module from `portfolio-client.ts`, which states:
 *
 *   "If a future portfolio_write need ever comes up, it must go through a
 *    different, explicitly-named module — never add a write method here."
 *
 * This is that module. The split is the whole point: anything reading the
 * portfolio imports the read client and structurally cannot mutate it, and
 * every mutation lives here where it can be reviewed in one place.
 *
 * Rules kept here:
 *   - Every statement is hand-written and parameterised; no generic query()
 *     escape hatch, so nothing can pass arbitrary SQL through.
 *   - Every statement is scoped by user_id, so a wrong id can never touch
 *     another owner's rows.
 *   - Money and quantity go to Postgres as strings. The columns are `decimal`,
 *     and round-tripping through a JS float silently loses precision on
 *     fractional share counts (the live portfolio has holdings like
 *     0.809883524).
 */

const portfolioDatabaseUrl = process.env.PORTFOLIO_DATABASE_URL
if (!portfolioDatabaseUrl) {
  throw new Error('PORTFOLIO_DATABASE_URL is not set — copy .env.example to .env and fill it in.')
}

const sql = neon(portfolioDatabaseUrl)

/**
 * The portfolio DB is single-owner: every row in positions/closed_positions
 * carries user_id 'demo-user', and the users table has exactly that one row.
 * Verified against the live database before this module was written. Keeping
 * the same id is what lets the old app and this one run side by side during
 * the migration.
 */
export const PORTFOLIO_USER_ID = 'demo-user'

import type { PositionType } from '../../shared/asset-types'
export type { PositionType }

export interface NewPosition {
  symbol: string
  name: string | null
  type: PositionType
  quantity: string
  buyPrice: string
  buyRate: string
  buyDate: string
}

/**
 * A complete row's worth of values, not a sparse patch.
 *
 * Neon's HTTP driver parameterises every interpolation, so a nested
 * `${sql`quantity`}` fragment would be sent as a bind value rather than as SQL
 * — silently writing garbage. Rather than build the statement dynamically, the
 * caller reads the current row, merges its changes in JS, and passes the whole
 * set here. One extra round-trip, no string-built SQL.
 */
export interface PositionValues {
  name: string | null
  quantity: string
  buyPrice: string
  buyRate: string
  buyDate: string
  currentPrice: string | null
}

export interface PositionRow {
  id: string
  symbol: string
  name: string | null
  type: string
  quantity: string
  buyPrice: string
  buyRate: string
  buyDate: string
  currentPrice: string | null
}

/**
 * A `timestamp`-without-zone value as an ISO string that means the same wall
 * clock. Shared with portfolio-client.ts's reader for the same reason.
 */
function naiveIso(v: unknown): string {
  if (!(v instanceof Date)) return String(v)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return (
    `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}` +
    `T${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}.${p(v.getMilliseconds(), 3)}Z`
  )
}

function toRow(r: Record<string, unknown>): PositionRow {
  return {
    id: String(r.id),
    symbol: r.symbol as string,
    name: (r.name as string | null) ?? null,
    type: r.type as string,
    quantity: String(r.quantity),
    buyPrice: String(r.buy_price),
    buyRate: String(r.buy_rate),
    // The column is `timestamp` with no zone, so the stored value IS the
    // calendar moment. The driver parses it in the process's local timezone,
    // which means its LOCAL components are the stored ones — re-emit those,
    // never toISOString(), which would re-anchor the value and move the day.
    buyDate: naiveIso(r.buy_date),
    currentPrice: r.current_price == null ? null : String(r.current_price),
  }
}

export const portfolioWriteRepo = {
  async getPosition(id: string): Promise<PositionRow | null> {
    const rows = await sql`
      SELECT id, symbol, name, type, quantity, buy_price, buy_rate, buy_date, current_price
      FROM positions
      WHERE id = ${id} AND user_id = ${PORTFOLIO_USER_ID}
      LIMIT 1
    `
    return rows[0] ? toRow(rows[0]) : null
  },

  async createPosition(p: NewPosition): Promise<PositionRow> {
    const rows = await sql`
      INSERT INTO positions (user_id, symbol, name, type, quantity, buy_price, buy_rate, buy_date)
      VALUES (
        ${PORTFOLIO_USER_ID}, ${p.symbol}, ${p.name}, ${p.type},
        ${p.quantity}, ${p.buyPrice}, ${p.buyRate}, ${p.buyDate}
      )
      RETURNING id, symbol, name, type, quantity, buy_price, buy_rate, buy_date, current_price
    `
    return toRow(rows[0])
  },

  /** Overwrites the editable columns with an already-merged set of values. */
  async updatePosition(id: string, v: PositionValues): Promise<PositionRow | null> {
    const rows = await sql`
      UPDATE positions SET
        name          = ${v.name},
        quantity      = ${v.quantity},
        buy_price     = ${v.buyPrice},
        buy_rate      = ${v.buyRate},
        buy_date      = ${v.buyDate},
        current_price = ${v.currentPrice},
        last_updated  = now()
      WHERE id = ${id} AND user_id = ${PORTFOLIO_USER_ID}
      RETURNING id, symbol, name, type, quantity, buy_price, buy_rate, buy_date, current_price
    `
    return rows[0] ? toRow(rows[0]) : null
  },

  /**
   * Writes ONLY the price. Refreshing a price used to go through
   * updatePosition, which meant reading the whole row and writing it all back —
   * including buy_date. That date is a `timestamp` with no zone: the driver
   * parsed it in the process's local timezone and the write put the shifted
   * instant back, so every refresh walked the purchase date backwards by the
   * local offset. Nineteen rows lost a day before it was caught.
   *
   * The columns a price refresh has any business touching are these two.
   */
  async updatePrice(id: string, currentPrice: string): Promise<boolean> {
    const rows = await sql`
      UPDATE positions
      SET current_price = ${currentPrice}, last_updated = now()
      WHERE id = ${id} AND user_id = ${PORTFOLIO_USER_ID}
      RETURNING id
    `
    return rows.length > 0
  },

  async deletePosition(id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM positions
      WHERE id = ${id} AND user_id = ${PORTFOLIO_USER_ID}
      RETURNING id
    `
    return rows.length > 0
  },

  async deleteClosedPosition(id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM closed_positions
      WHERE id = ${id} AND user_id = ${PORTFOLIO_USER_ID}
      RETURNING id
    `
    return rows.length > 0
  },

  /** Writes the closed-position record. Caller handles the open-position side. */
  async insertClosedPosition(c: {
    symbol: string
    name: string | null
    type: string
    quantity: string
    buyPrice: string
    buyRate: string
    sellPrice: string
    buyDate: string
    sellDate: string
    pl: string
    plPercent: string
  }): Promise<{ id: string }> {
    const rows = await sql`
      INSERT INTO closed_positions (
        user_id, symbol, name, type, quantity, buy_price, buy_rate,
        sell_price, buy_date, sell_date, pl, pl_percent, commission
      )
      VALUES (
        ${PORTFOLIO_USER_ID}, ${c.symbol}, ${c.name}, ${c.type}, ${c.quantity},
        ${c.buyPrice}, ${c.buyRate}, ${c.sellPrice}, ${c.buyDate}, ${c.sellDate},
        ${c.pl}, ${c.plPercent}, '0'
      )
      RETURNING id
    `
    return { id: String(rows[0].id) }
  },

  /** Reduces an open position's quantity — the remaining half of a partial sale. */
  async reduceQuantity(id: string, remaining: string): Promise<void> {
    await sql`
      UPDATE positions
      SET quantity = ${remaining}
      WHERE id = ${id} AND user_id = ${PORTFOLIO_USER_ID}
    `
  },
}
