import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { tradePlans } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { parseRecords } from '../lib/validation'
import { fetchSharePrices, PriceSourceUnavailable } from '../services/price-source'

export const tradePlansRouter = Router()

// GET /api/trade-plans → all plans, most recently updated first
tradePlansRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(tradePlans).orderBy(desc(tradePlans.updatedAt)).limit(100)
  res.json(rows)
})

/**
 * GET /api/trade-plans/live-prices → { prices, readAt, stale }
 *
 * The ~15-minute-delayed price from the same sheet the portfolio reads, for
 * every plan ticker the sheet tracks. `trade_plans.currentPrice` is what the
 * last CONTENT round wrote — normally the previous session's close — and the
 * Fikirler screen was showing it as "Son fiyat" all day long.
 *
 * Only a single sheet read, shared with the portfolio's (60s cache, one request
 * in flight). A ticker the sheet doesn't track is simply absent; the client
 * falls back to the plan's own price and says so.
 *
 * Declared BEFORE `/:ticker`, which would otherwise swallow this path.
 */
tradePlansRouter.get('/live-prices', async (_req, res) => {
  try {
    const rows = await db.select({ ticker: tradePlans.ticker }).from(tradePlans)
    const { prices, stale, at } = await fetchSharePrices(false, { attempts: 1, timeoutMs: 60_000 })
    const out: Record<string, number> = {}
    for (const { ticker } of rows) {
      const p = prices[ticker.toUpperCase()]
      if (p != null) out[ticker] = p
    }
    res.json({ prices: out, readAt: at ? new Date(at).toISOString() : null, stale })
  } catch (e) {
    // A dead source is not an empty answer — the client keeps the plan price.
    if (e instanceof PriceSourceUnavailable) return res.status(503).json({ error: e.message })
    throw e
  }
})

// GET /api/trade-plans/:ticker → latest plan for a ticker
tradePlansRouter.get('/:ticker', async (req, res) => {
  const rows = await db
    .select()
    .from(tradePlans)
    .where(eq(tradePlans.ticker, req.params.ticker.toUpperCase()))
    .orderBy(desc(tradePlans.updatedAt))
    .limit(1)
  res.json(rows[0] ?? null)
})

const ohlc = z.object({
  t: z.string(),
  o: z.coerce.number(),
  h: z.coerce.number(),
  l: z.coerce.number(),
  c: z.coerce.number(),
})

// Accepts camelCase keys — matches what Claude Chat generates and the admin EXAMPLES.
export const tradePlanInput = z.object({
  ticker: z.string(),
  exchange: z.string().nullish(),
  currentPrice: z.coerce.number().nullish(),
  entryLow: z.coerce.number().nullish(),
  entryHigh: z.coerce.number().nullish(),
  tp1: z.coerce.number().nullish(),
  tp2: z.coerce.number().nullish(),
  tp3: z.coerce.number().nullish(),
  hardSl: z.coerce.number().nullish(),
  thesis: z.string().nullish(),
  invalidation: z.string().nullish(),
  priceHistory: z.array(ohlc).nullish(),
  // Merge-by-date into the existing price_history instead of replacing it —
  // see appendPriceHistory handling in bulk-import.ts. Plain /api/trade-plans
  // POST (insert-only) ignores this; only bulk-import's update branch uses it.
  appendPriceHistory: z.array(ohlc).nullish(),
  status: z.string().nullish(), // active | stopped
})

// POST /api/trade-plans (admin) — single plan or array
tradePlansRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = parseRecords(tradePlanInput, req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.issues })
    return
  }
  const rows = await db
    .insert(tradePlans)
    .values(
      parsed.data.map((d) => ({
        ticker: d.ticker.toUpperCase(),
        exchange: d.exchange ?? null,
        currentPrice: d.currentPrice ?? null,
        entryLow: d.entryLow ?? null,
        entryHigh: d.entryHigh ?? null,
        tp1: d.tp1 ?? null,
        tp2: d.tp2 ?? null,
        tp3: d.tp3 ?? null,
        hardSl: d.hardSl ?? null,
        thesis: d.thesis ?? null,
        invalidation: d.invalidation ?? null,
        priceHistory: d.priceHistory ?? null,
        ...(d.status ? { status: d.status } : {}),
      })),
    )
    .returning()
  res.status(201).json(rows)
})
