import { Router } from 'express'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db/client'
import { notePages, noteSections } from '../db/schema'

/**
 * The notebook's CRUD.
 *
 * Mounted behind the session gate like everything else under /api (GÖREV 45),
 * so there is no per-route guard here — one door, checked in one place.
 *
 * Page content is never inspected: it is BlockNote's document shape, stored
 * verbatim. A server that parsed it would need updating every time the editor
 * gained a block type, for no gain — nothing here queries inside a note.
 */
export const notesRouter = Router()

const sectionInput = z.object({ title: z.string().trim().min(1).max(120) })
const pageInput = z.object({
  sectionId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
})
const pagePatch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.array(z.unknown()).optional(),
  pinned: z.boolean().optional(),
  sectionId: z.number().int().positive().optional(),
})

function bad(res: Parameters<Parameters<typeof notesRouter.get>[1]>[1], e: unknown) {
  res.status(400).json({ error: e instanceof z.ZodError ? e.issues : 'invalid_body' })
}

// ─── read ────────────────────────────────────────────────────────────────────

/**
 * Everything the sidebar needs in one request — page bodies excluded.
 *
 * The list is small but a body is not: loading every note to draw a list of
 * titles would grow the response with every page written. Bodies come one at a
 * time, from /pages/:id.
 */
notesRouter.get('/', async (_req, res) => {
  const [sections, pages] = await Promise.all([
    db.select().from(noteSections).orderBy(asc(noteSections.position), asc(noteSections.id)),
    db
      .select({
        id: notePages.id,
        sectionId: notePages.sectionId,
        title: notePages.title,
        pinned: notePages.pinned,
        position: notePages.position,
        updatedAt: notePages.updatedAt,
      })
      .from(notePages)
      .orderBy(asc(notePages.position), asc(notePages.id)),
  ])
  res.json({ sections, pages })
})

notesRouter.get('/pages/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return bad(res, 'invalid_id')
  const [page] = await db.select().from(notePages).where(eq(notePages.id, id)).limit(1)
  if (!page) return void res.status(404).json({ error: 'not_found' })
  res.json(page)
})

// ─── sections ────────────────────────────────────────────────────────────────

notesRouter.post('/sections', async (req, res) => {
  try {
    const { title } = sectionInput.parse(req.body)
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${noteSections.position}), 0) + 1` })
      .from(noteSections)
    const [row] = await db.insert(noteSections).values({ title, position: next }).returning()
    res.json(row)
  } catch (e) {
    bad(res, e)
  }
})

notesRouter.patch('/sections/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return bad(res, 'invalid_id')
  try {
    const { title } = sectionInput.parse(req.body)
    const [row] = await db
      .update(noteSections)
      .set({ title })
      .where(eq(noteSections.id, id))
      .returning()
    if (!row) return void res.status(404).json({ error: 'not_found' })
    res.json(row)
  } catch (e) {
    bad(res, e)
  }
})

/** Pages go with it — the foreign key cascades, so one statement is enough. */
notesRouter.delete('/sections/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return bad(res, 'invalid_id')
  const rows = await db.delete(noteSections).where(eq(noteSections.id, id)).returning({ id: noteSections.id })
  if (!rows.length) return void res.status(404).json({ error: 'not_found' })
  res.json({ ok: true })
})

// ─── pages ───────────────────────────────────────────────────────────────────

notesRouter.post('/pages', async (req, res) => {
  try {
    const { sectionId, title } = pageInput.parse(req.body)
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${notePages.position}), 0) + 1` })
      .from(notePages)
      .where(eq(notePages.sectionId, sectionId))
    const [row] = await db
      .insert(notePages)
      .values({ sectionId, title: title ?? 'Yeni sayfa', position: next, content: null })
      .returning()
    res.json(row)
  } catch (e) {
    bad(res, e)
  }
})

/**
 * One endpoint for title, body and pin.
 *
 * Autosave fires on every pause in typing, so the common call carries only
 * `content`; splitting these into three routes would mean three round trips for
 * what the editor thinks of as one page.
 */
notesRouter.patch('/pages/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return bad(res, 'invalid_id')
  try {
    const patch = pagePatch.parse(req.body)
    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.title !== undefined) values.title = patch.title
    if (patch.content !== undefined) values.content = patch.content
    if (patch.pinned !== undefined) values.pinned = patch.pinned
    if (patch.sectionId !== undefined) values.sectionId = patch.sectionId

    const [row] = await db.update(notePages).set(values).where(eq(notePages.id, id)).returning({
      id: notePages.id,
      title: notePages.title,
      pinned: notePages.pinned,
      sectionId: notePages.sectionId,
      updatedAt: notePages.updatedAt,
    })
    if (!row) return void res.status(404).json({ error: 'not_found' })
    res.json(row)
  } catch (e) {
    bad(res, e)
  }
})

notesRouter.delete('/pages/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return bad(res, 'invalid_id')
  const rows = await db.delete(notePages).where(eq(notePages.id, id)).returning({ id: notePages.id })
  if (!rows.length) return void res.status(404).json({ error: 'not_found' })
  res.json({ ok: true })
})
