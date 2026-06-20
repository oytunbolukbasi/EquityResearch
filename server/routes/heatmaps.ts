import { Router } from 'express'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { heatmaps } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { parseRecords } from '../lib/validation'

export const heatmapsRouter = Router()

// GET /api/heatmaps?market=BIST|US&date=YYYY-MM-DD
// market + no date → single latest for that market (the widget case)
// otherwise → array
heatmapsRouter.get('/', async (req, res) => {
  const market = typeof req.query.market === 'string' ? req.query.market : undefined
  const date = typeof req.query.date === 'string' ? req.query.date : undefined

  const conds: SQL[] = []
  if (market) conds.push(eq(heatmaps.market, market))
  if (date) conds.push(eq(heatmaps.date, date))

  const rows = await db
    .select()
    .from(heatmaps)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(heatmaps.date), desc(heatmaps.createdAt))
    .limit(market && !date ? 1 : 50)

  if (market && !date) {
    res.json(rows[0] ?? null)
    return
  }
  res.json(rows)
})

// Accepts both change_pct (canonical) and changePct (what Claude Chat generates).
// Stored as change_pct to match the HeatmapSector type used by widgets.
const sector = z
  .object({
    name: z.string(),
    change_pct: z.coerce.number().optional(),
    changePct: z.coerce.number().optional(),
    note: z.string().nullish(),
  })
  .transform(({ name, change_pct, changePct, note }) => ({
    name,
    change_pct: change_pct ?? changePct ?? 0,
    ...(note != null ? { note } : {}),
  }))

const heatmapInput = z.object({
  date: z.string(),
  market: z.string(),
  sectors: z.array(sector).nullish(),
})

// POST /api/heatmaps (admin) — single heatmap or array
heatmapsRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = parseRecords(heatmapInput, req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.issues })
    return
  }
  const rows = await db
    .insert(heatmaps)
    .values(
      parsed.data.map((d) => ({
        date: d.date,
        market: d.market,
        sectors: d.sectors ?? null,
      })),
    )
    .returning()
  res.status(201).json(rows)
})
