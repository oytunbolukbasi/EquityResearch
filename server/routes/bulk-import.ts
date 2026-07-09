import { Router } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { z, type ZodType } from 'zod'

import { db } from '../db/client'
import { morningNotes, ideas, tradePlans, portfolioInsights, type OhlcPoint } from '../db/schema'
import { requireAdmin } from '../middleware/require-admin'
import { morningNoteInput } from './morning-notes'
import { ideaInput } from './ideas'
import { tradePlanInput } from './trade-plans'
import { alpacaFetch, AlpacaError } from '../lib/alpaca'

const portfolioActionSchema = z.object({
  ticker: z.string(),
  action: z.string(),
  reason: z.string(),
})

const portfolioInsightInput = z.object({
  date: z.string(),
  body: z.string().optional(),
  summary: z.string().optional(),
  actions: z.array(portfolioActionSchema).nullish(),
})

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

  type AlpacaAction = { action: 'buy'; ticker: string; limitPrice: number } | { action: 'stop'; ticker: string }
  const alpacaActions: AlpacaAction[] = []

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
      // Also select exchange so we can use it for status-only updates where
      // d.exchange might be null (the payload only includes what changed).
      const existing = await db
        .select({ id: ideas.id, exchange: ideas.exchange })
        .from(ideas)
        .where(and(eq(ideas.date, d.date), eq(ideas.ticker, d.ticker)))
        .limit(1)
      if (existing.length) {
        await db.update(ideas).set(values).where(eq(ideas.id, existing[0].id))
      } else {
        await db.insert(ideas).values(values)
      }

      // Alpaca auto-order: only for US exchanges (NYSE/NASDAQ)
      const exchange = (d.exchange ?? existing[0]?.exchange ?? '').toUpperCase()
      const isUS = exchange === 'NYSE' || exchange === 'NASDAQ'
      if (isUS) {
        if (d.status === 'active' && !existing.length && d.entryHigh != null) {
          // New US idea → queue a limit buy at entryHigh
          alpacaActions.push({ action: 'buy', ticker: d.ticker.toUpperCase(), limitPrice: d.entryHigh })
        } else if (d.status === 'stopped') {
          // Stopped → cancel open orders and/or close position
          alpacaActions.push({ action: 'stop', ticker: d.ticker.toUpperCase() })
        }
      }
    })

    // Process queued Alpaca actions after all DB writes succeed
    for (const act of alpacaActions) {
      try {
        if (act.action === 'buy') {
          // Skip if an open order for this ticker already exists
          const open = await alpacaFetch<{ id: string }[]>(
            `/v2/orders?status=open&symbols=${encodeURIComponent(act.ticker)}&limit=10`,
          )
          if (!open?.length) {
            const order = await alpacaFetch('/v2/orders', {
              method: 'POST',
              body: JSON.stringify({
                symbol: act.ticker,
                qty: '1',
                side: 'buy',
                type: 'limit',
                time_in_force: 'gtc',
                limit_price: String(act.limitPrice),
              }),
            })
            console.log(`[alpaca] limit buy created: ${act.ticker} @ ${act.limitPrice}`, (order as Record<string, unknown>)?.['id'])
          } else {
            console.log(`[alpaca] skipped buy: ${act.ticker} already has open order`)
          }
        } else {
          // 1. Cancel any pending limit orders BEFORE placing the market sell,
          //    so the sell order we create isn't included in the cancellation pass.
          const openOrders = await alpacaFetch<{ id: string }[]>(
            `/v2/orders?status=open&symbols=${encodeURIComponent(act.ticker)}&limit=10`,
          )
          for (const o of openOrders ?? []) {
            await alpacaFetch(`/v2/orders/${o.id}`, { method: 'DELETE' })
            console.log(`[alpaca] order cancelled: ${act.ticker} ${o.id}`)
          }
          // 2. Close position if one exists
          try {
            const pos = await alpacaFetch<{ qty: string }>(`/v2/positions/${act.ticker}`)
            if (pos) {
              await alpacaFetch('/v2/orders', {
                method: 'POST',
                body: JSON.stringify({
                  symbol: act.ticker,
                  qty: String(Math.abs(parseFloat(pos.qty))),
                  side: 'sell',
                  type: 'market',
                  time_in_force: 'day',
                }),
              })
              console.log(`[alpaca] market sell created: ${act.ticker}`)
            }
          } catch (e) {
            // 404 = no position, that's fine
            if (!(e instanceof AlpacaError && e.statusCode === 404)) throw e
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[alpaca] action failed for ${act.ticker}:`, e)
        warnings.push(`alpaca/${act.ticker}: ${msg}`)
      }
    }
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
        .orderBy(desc(tradePlans.updatedAt))
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
        if (d.appendPriceHistory?.length) {
          patch.priceHistory = mergePriceHistory(existing[0].priceHistory, d.appendPriceHistory)
        } else if (Object.prototype.hasOwnProperty.call(raw, 'priceHistory') && d.priceHistory != null) {
          // Only allow a full priceHistory overwrite when a non-null array is
          // explicitly provided — prevents accidental wipes from stray
          // `"priceHistory": null` in payloads that only intend to update
          // status/currentPrice.
          patch.priceHistory = d.priceHistory
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

  if (body.portfolio_insight !== undefined) {
    results.portfolio_insight = await upsertTable(portfolioInsightInput, body.portfolio_insight, async (d) => {
      const bodyText = d.summary ?? d.body ?? ''
      const values = {
        date: d.date,
        body: bodyText,
        actions: d.actions ?? null,
      }
      const existing = await db
        .select({ id: portfolioInsights.id })
        .from(portfolioInsights)
        .where(eq(portfolioInsights.date, d.date))
        .limit(1)
      if (existing.length) {
        await db.update(portfolioInsights).set(values).where(eq(portfolioInsights.id, existing[0].id))
      } else {
        await db.insert(portfolioInsights).values(values)
      }
    })
  }

  res.json({ success: true, results, ...(warnings.length ? { warnings } : {}) })
})
