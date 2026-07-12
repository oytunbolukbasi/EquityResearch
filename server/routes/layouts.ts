import { Router } from 'express'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { layouts } from '../db/schema'

export const layoutsRouter = Router()

// GET /api/layouts?deviceKey=desktop:chrome → newest saved layout for that
// device/browser, or null. Public read (layout data is non-sensitive).
layoutsRouter.get('/', async (req, res) => {
  const deviceKey = typeof req.query.deviceKey === 'string' ? req.query.deviceKey : undefined
  if (!deviceKey) {
    res.status(400).json({ error: 'deviceKey_required' })
    return
  }
  const rows = await db
    .select()
    .from(layouts)
    .where(eq(layouts.deviceKey, deviceKey))
    .orderBy(desc(layouts.createdAt))
    .limit(1)
  res.json(rows[0] ?? null)
})

// items/layout are the client's react-grid-layout state — opaque arrays we
// store verbatim and hand back on restore, so keep validation permissive.
const layoutInput = z.object({
  deviceKey: z.string().min(1),
  items: z.array(z.any()),
  layout: z.array(z.any()),
})

// POST /api/layouts — save the current layout. Public (no admin key): this is
// a personal per-device convenience and the payload carries no sensitive data.
// Each save is a new row; the newest per deviceKey wins on restore.
layoutsRouter.post('/', async (req, res) => {
  const parsed = layoutInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })
    return
  }
  const rows = await db
    .insert(layouts)
    .values({
      deviceKey: parsed.data.deviceKey,
      items: parsed.data.items,
      layout: parsed.data.layout,
    })
    .returning()
  res.status(201).json(rows[0])
})
