import { Router } from 'express'
import { and, eq } from 'drizzle-orm'
import type { ZodType } from 'zod'

import { db } from '../db/client'
import { morningNotes, ideas, heatmaps, tradePlans, type OhlcPoint } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { morningNoteInput } from './morning-notes'
import { ideaInput } from './ideas'
import { heatmapInput } from './heatmaps'
import { tradePlanInput } from './trade-plans'

export const bulkImportRouter = Router()

type TableResult = number | { error: string }

// Merge `toAppend` into `existing` keyed by date ("t") — a bar with a date
// that's already present overwrites that bar (DO UPDATE), a new date gets
// added — then returns everything sorted ascending by date.
function mergePriceHistory(existing: OhlcPoint[] | null, toAppend: OhlcPoint[]): OhlcPoint[] {
  const byDate = new Map<string, OhlcPoint>()
  for (const bar of existing ?? []) byDate.set(bar.t, bar)
  for (const bar of toAppend) byDate.set(bar.t, bar)
  return [...byDate.values()].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
}

function zodErrorMessage(err: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return err.issues
    .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

/**
 * Validates `raw` (a single object or array) against `schema` item-by-item and
 * runs `upsert` for each. A single bad item fails the whole table (returned as
 * { error }) so partial row-level writes never get silently swallowed, but
 * other tables in the same request still proceed independently.
 */
async function upsertTable<T>(
  schema: ZodType<T>,
  raw: unknown,
  upsert: (parsed: T, rawItem: unknown) => Promise<void>,
): Promise<TableResult> {
  const list = Array.isArray(raw) ? raw : [raw]
  if (!list.length) return 0
  try {
    for (const rawItem of list) {
      const parsed = schema.safeParse(rawItem)
      if (!parsed.success) return { error: zodErrorMessage(parsed.error) }
      await upsert(parsed.data, rawItem)
    }
    return list.length
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// POST /api/admin/bulk-import (admin) — upserts any subset of the 4 tables in one call.
bulkImportRouter.post('/', requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const results: Record<string, TableResult> = {}
  const warnings: string[] = []

  if (body.morning_note !== undefined) {
    results.morning_note = await upsertTable(morningNoteInput, body.morning_note, async (d) => {
      const values = {
        date: d.date,
        topCall: d.topCall ?? null,
        macroBullets: d.macroBullets ?? null,
        sectorDeepDive: d.sectorDeepDive ?? null,
      }
      const existing = await db
        .select({ id: morningNotes.id })
        .from(morningNotes)
        .where(eq(morningNotes.date, d.date))
        .limit(1)
      if (existing.length) {
        await db.update(morningNotes).set(values).where(eq(morningNotes.id, existing[0].id))
      } else {
        await db.insert(morningNotes).values(values)
      }
    })
  }

  if (body.ideas !== undefined) {
    results.ideas = await upsertTable(ideaInput, body.ideas, async (d) => {
      const values = {
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
      }
      const existing = await db
        .select({ id: ideas.id })
        .from(ideas)
        .where(and(eq(ideas.date, d.date), eq(ideas.ticker, d.ticker)))
        .limit(1)
      if (existing.length) {
        await db.update(ideas).set(values).where(eq(ideas.id, existing[0].id))
      } else {
        await db.insert(ideas).values(values)
      }
    })
  }

  if (body.heatmaps !== undefined) {
    results.heatmaps = await upsertTable(heatmapInput, body.heatmaps, async (d) => {
      const values = { date: d.date, market: d.market, sectors: d.sectors ?? null }
      const existing = await db
        .select({ id: heatmaps.id })
        .from(heatmaps)
        .where(and(eq(heatmaps.market, d.market), eq(heatmaps.date, d.date)))
        .limit(1)
      if (existing.length) {
        await db.update(heatmaps).set(values).where(eq(heatmaps.id, existing[0].id))
      } else {
        await db.insert(heatmaps).values(values)
      }
    })
  }

  if (body.trade_plans !== undefined) {
    results.trade_plans = await upsertTable(tradePlanInput, body.trade_plans, async (d, rawItem) => {
      const ticker = d.ticker.toUpperCase()
      const raw = rawItem as Record<string, unknown>

      if (d.priceHistory && d.priceHistory.length < 20) {
        const msg = `⚠️ ${ticker} priceHistory kısa: ${d.priceHistory.length} bar var, beklenen ≥20`
        console.warn(msg)
        warnings.push(msg)
      }

      const existing = await db
        .select({ id: tradePlans.id, priceHistory: tradePlans.priceHistory })
        .from(tradePlans)
        .where(eq(tradePlans.ticker, ticker))
        .limit(1)

      if (existing.length) {
        // entryLow/entryHigh/tp1-3/hardSl/thesis/invalidation are admin/chat-only
        // fields on an EXISTING plan — never written here, even if present in
        // the payload, UNLESS the caller explicitly opts in with
        // `updateLevels: true` (a deliberate "yes, replace the plan's levels"
        // flag, not just including the fields). Otherwise only currentPrice,
        // status, and (optionally) priceHistory move through this endpoint on
        // update, and only when the caller actually included that key.
        const patch: {
          currentPrice?: number | null
          priceHistory?: typeof d.priceHistory
          status?: string
          entryLow?: number | null
          entryHigh?: number | null
          tp1?: number | null
          tp2?: number | null
          tp3?: number | null
          hardSl?: number | null
          thesis?: string | null
          invalidation?: string | null
          updatedAt: Date
        } = { updatedAt: new Date() }
        if (Object.prototype.hasOwnProperty.call(raw, 'currentPrice')) {
          patch.currentPrice = d.currentPrice ?? null
        }
        if (Object.prototype.hasOwnProperty.call(raw, 'priceHistory')) {
          patch.priceHistory = d.priceHistory ?? null
        }
        if (d.appendPriceHistory?.length) {
          // Merge wins over a plain `priceHistory` overwrite if both are
          // somehow present in the same payload — append is the more
          // specific, deliberate instruction.
          patch.priceHistory = mergePriceHistory(existing[0].priceHistory, d.appendPriceHistory)
        }
        if (Object.prototype.hasOwnProperty.call(raw, 'status') && d.status) {
          patch.status = d.status
        }
        if (raw.updateLevels === true) {
          // Only touch the keys actually present in the payload — a partial
          // level update (e.g. just entryLow/entryHigh) must not null out
          // tp2/tp3/invalidation etc. just because they were omitted.
          const has = (key: string) => Object.prototype.hasOwnProperty.call(raw, key)
          if (has('entryLow'))      patch.entryLow      = d.entryLow ?? null
          if (has('entryHigh'))     patch.entryHigh     = d.entryHigh ?? null
          if (has('tp1'))           patch.tp1           = d.tp1 ?? null
          if (has('tp2'))           patch.tp2           = d.tp2 ?? null
          if (has('tp3'))           patch.tp3           = d.tp3 ?? null
          if (has('hardSl'))        patch.hardSl        = d.hardSl ?? null
          if (has('thesis'))        patch.thesis        = d.thesis ?? null
          if (has('invalidation'))  patch.invalidation  = d.invalidation ?? null
        }
        await db.update(tradePlans).set(patch).where(eq(tradePlans.id, existing[0].id))
      } else {
        // No existing row for this ticker — this is a brand-new plan, so the
        // full payload (entry/targets/thesis included) gets written, not just
        // the update-only subset above.
        await db.insert(tradePlans).values({
          ticker,
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
          priceHistory: d.appendPriceHistory?.length
            ? mergePriceHistory(d.priceHistory ?? null, d.appendPriceHistory)
            : d.priceHistory ?? null,
          ...(d.status ? { status: d.status } : {}),
        })
      }
    })
  }

  res.json({ success: true, results, ...(warnings.length ? { warnings } : {}) })
})
