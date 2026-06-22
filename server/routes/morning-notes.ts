import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { morningNotes } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { parseRecords } from '../lib/validation'

export const morningNotesRouter = Router()

// GET /api/morning-notes?date=YYYY-MM-DD → single record (by date, else latest)
morningNotesRouter.get('/', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  const rows = date
    ? await db.select().from(morningNotes).where(eq(morningNotes.date, date)).limit(1)
    : await db
        .select()
        .from(morningNotes)
        .orderBy(desc(morningNotes.date), desc(morningNotes.createdAt))
        .limit(1)
  res.json(rows[0] ?? null)
})

// GET /api/morning-notes/history
morningNotesRouter.get('/history', async (_req, res) => {
  const rows = await db
    .select()
    .from(morningNotes)
    .orderBy(desc(morningNotes.date), desc(morningNotes.createdAt))
    .limit(100)
  res.json(rows)
})

// Accepts camelCase keys — matches what the admin page EXAMPLES show and what
// Claude Chat naturally generates.
export const morningNoteInput = z.object({
  date: z.string(),
  topCall: z.string().nullish(),
  macroBullets: z.array(z.any()).nullish(),
  sectorDeepDive: z.any().nullish(),
})

// POST /api/morning-notes (admin)
morningNotesRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = parseRecords(morningNoteInput, req.body)
  if (!parsed.ok) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.issues })
    return
  }
  const rows = await db
    .insert(morningNotes)
    .values(
      parsed.data.map((d) => ({
        date: d.date,
        topCall: d.topCall ?? null,
        macroBullets: d.macroBullets ?? null,
        sectorDeepDive: d.sectorDeepDive ?? null,
      })),
    )
    .returning()
  res.status(201).json(rows)
})
