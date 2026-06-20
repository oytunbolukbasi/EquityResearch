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

const ideaInput = z.object({
  date: z.string(),
  ticker: z.string(),
  exchange: z.string().nullish(),
  direction: z.string().nullish(),
  thesis: z.string().nullish(),
  metrics: z.any().nullish(),
  entry_low: z.coerce.number().nullish(),
  entry_high: z.coerce.number().nullish(),
  stop_loss: z.coerce.number().nullish(),
  target_1: z.coerce.number().nullish(),
  target_2: z.coerce.number().nullish(),
  risk_reward_h1: z.coerce.number().nullish(),
  note: z.string().nullish(),
  risk_note: z.string().nullish(),
  status: z.enum(['active', 'hit_target', 'stopped', 'watch']).nullish(),
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
        entryLow: d.entry_low ?? null,
        entryHigh: d.entry_high ?? null,
        stopLoss: d.stop_loss ?? null,
        target1: d.target_1 ?? null,
        target2: d.target_2 ?? null,
        riskRewardH1: d.risk_reward_h1 ?? null,
        note: d.note ?? null,
        riskNote: d.risk_note ?? null,
        ...(d.status ? { status: d.status } : {}),
      })),
    )
    .returning()
  res.status(201).json(rows)
})
