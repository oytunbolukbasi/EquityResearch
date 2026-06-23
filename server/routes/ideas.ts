import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { ideas } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { parseRecords } from '../lib/validation'

export const ideasRouter = Router()

// GET /api/ideas?date=YYYY-MM-DD → ideas for that date.
// Without a date: one row per ticker (each ticker's own latest record by
// date, then id as a tiebreaker) — NOT "every idea on the single latest
// date", since unchanged positions stay parked on their original date and
// would otherwise vanish from the "current" view the moment a newer ticker
// is added on a different day.
ideasRouter.get('/', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined

  if (date) {
    const rows = await db
      .select()
      .from(ideas)
      .where(eq(ideas.date, date))
      .orderBy(desc(ideas.createdAt))
    res.json(rows)
    return
  }

  const latestPerTicker = db
    .selectDistinctOn([ideas.ticker])
    .from(ideas)
    .orderBy(ideas.ticker, desc(ideas.date), desc(ideas.id))
    .as('latest_per_ticker')

  const rows = await db
    .select()
    .from(latestPerTicker)
    .orderBy(desc(latestPerTicker.date))
  res.json(rows)
})

// GET /api/ideas/history → all ideas, newest first
ideasRouter.get('/history', async (_req, res) => {
  const rows = await db
    .select()
    .from(ideas)
    .orderBy(desc(ideas.date), desc(ideas.createdAt))
    .limit(500)
  res.json(rows)
})

// Accepts camelCase keys. status aliases: "watching"→"watch", "target_hit"→"hit_target".
// target3 is accepted but not stored (ideas table has target1+target2 only).
export const ideaInput = z.object({
  date: z.string(),
  ticker: z.string(),
  exchange: z.string().nullish(),
  direction: z.string().nullish(),
  thesis: z.string().nullish(),
  metrics: z.any().nullish(),
  entryLow: z.coerce.number().nullish(),
  entryHigh: z.coerce.number().nullish(),
  stopLoss: z.coerce.number().nullish(),
  target1: z.coerce.number().nullish(),
  target2: z.coerce.number().nullish(),
  target3: z.coerce.number().nullish(),
  riskRewardH1: z.coerce.number().nullish(),
  note: z.string().nullish(),
  riskNote: z.string().nullish(),
  status: z.string().nullish().transform((s) => {
    if (!s) return s
    if (s === 'watching') return 'watch'
    if (s === 'target_hit') return 'hit_target'
    return s
  }),
})

// POST /api/ideas (admin) — accepts a single idea or an array
ideasRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = parseRecords(ideaInput, req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.issues })
    return
  }
  const rows = await db
    .insert(ideas)
    .values(
      parsed.data.map((d) => ({
        date: d.date,
        ticker: d.ticker,
        exchange: d.exchange ?? null,
        direction: d.direction ?? null,
        thesis: d.thesis ?? null,
        metrics: d.metrics ?? null,
        entryLow: d.entryLow ?? null,
        entryHigh: d.entryHigh ?? null,
        stopLoss: d.stopLoss ?? null,
        target1: d.target1 ?? null,
        target2: d.target2 ?? null,
        riskRewardH1: d.riskRewardH1 ?? null,
        note: d.note ?? null,
        riskNote: d.riskNote ?? null,
        ...(d.status ? { status: d.status } : {}),
      })),
    )
    .returning()
  res.status(201).json(rows)
})
