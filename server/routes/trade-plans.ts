import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { tradePlans } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { parseRecords } from '../lib/validation'

export const tradePlansRouter = Router()

// GET /api/trade-plans → all plans, most recently updated first
tradePlansRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(tradePlans).orderBy(desc(tradePlans.updatedAt)).limit(100)
  res.json(rows)
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

const tradePlanInput = z.object({
  ticker: z.string(),
  exchange: z.string().nullish(),
  current_price: z.coerce.number().nullish(),
  entry_low: z.coerce.number().nullish(),
  entry_high: z.coerce.number().nullish(),
  tp1: z.coerce.number().nullish(),
  tp2: z.coerce.number().nullish(),
  tp3: z.coerce.number().nullish(),
  hard_sl: z.coerce.number().nullish(),
  thesis: z.string().nullish(),
  invalidation: z.string().nullish(),
  price_history: z.array(ohlc).nullish(),
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
        currentPrice: d.current_price ?? null,
        entryLow: d.entry_low ?? null,
        entryHigh: d.entry_high ?? null,
        tp1: d.tp1 ?? null,
        tp2: d.tp2 ?? null,
        tp3: d.tp3 ?? null,
        hardSl: d.hard_sl ?? null,
        thesis: d.thesis ?? null,
        invalidation: d.invalidation ?? null,
        priceHistory: d.price_history ?? null,
      })),
    )
    .returning()
  res.status(201).json(rows)
})
