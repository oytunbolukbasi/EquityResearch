import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { ideas } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { parseRecords } from '../lib/validation'

export const ideasRouter = Router()

// GET /api/ideas?date=YYYY-MM-DD → ideas for that date, else the latest date's
ideasRouter.get('/', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  let targetDate = date
  if (!targetDate) {
    const latest = await db.select({ date: ideas.date }).from(ideas).orderBy(desc(ideas.date)).limit(1)
    if (!latest.length) {
      res.json([])
      return
    }
    targetDate = latest[0].date
  }
  const rows = await db
    .select()
    .from(ideas)
    .where(eq(ideas.date, targetDate))
    .orderBy(desc(ideas.createdAt))
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
const ideaInput = z.object({
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
