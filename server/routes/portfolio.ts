import { Router } from 'express'
import { desc } from 'drizzle-orm'

import { db } from '../db/client'
import { portfolioInsights } from '../db/schema'
import { portfolioRepo } from '../db/portfolio-client'
import { getRates } from '../services/exchange-rate'
import { CURRENCY_FOR_TYPE, type PositionType } from '../../shared/asset-types'
import { fetchSharePrices } from '../services/price-source'

export const portfolioRouter = Router()

// GET /api/portfolio/insight → most recent daily commentary (main DB, not
// the portfolio DB — this is our own generated narrative).
portfolioRouter.get('/insight', async (_req, res) => {
  const rows = await db
    .select()
    .from(portfolioInsights)
    .orderBy(desc(portfolioInsights.date), desc(portfolioInsights.createdAt))
    .limit(1)
  res.json(rows[0] ?? null)
})

// GET /api/portfolio/summary — open positions with derived P/L. Read-only
// against the separate portfolio DB.
portfolioRouter.get('/summary', async (_req, res) => {
  const [positions, { rates, fallback }] = await Promise.all([
    portfolioRepo.getOpenPositions(),
    getRates(),
  ])

  // Figures stay in the POSITION's currency here. Converting to lira is the
  // panel's job and it already does it in one place (analytics-calc); a second
  // conversion on this side would be the same money computed twice.
  const enriched = positions.map((p) => {
    const costBasis = p.quantity * p.buyPrice
    const currentValue = p.currentPrice != null ? p.quantity * p.currentPrice : null
    const plAmount = currentValue != null ? currentValue - costBasis : null
    const plPercent = plAmount != null && costBasis !== 0 ? (plAmount / costBasis) * 100 : null

    return {
      ...p,
      currency: CURRENCY_FOR_TYPE[p.type as PositionType] ?? 'TRY',
      costBasis,
      currentValue,
      plAmount,
      plPercent,
    }
  })

  res.json({ positions: enriched, rates, ratesFallback: fallback })
})

/**
 * GET /api/portfolio/price-source — can this server actually reach the price sheet?
 *
 * Exists because a refresh that returns "0 updated, 17 skipped" looks identical
 * whether the sheet is empty, the URL is unset, or the host can't reach Google —
 * and the same code path worked locally while failing in production, which is
 * exactly the case that needs an answer from the deployed server itself.
 *
 * Public on purpose so it can be checked without a session, and deliberately
 * says nothing sensitive: no URL, no prices, just reachability and a count.
 */
portfolioRouter.get('/price-source', async (_req, res) => {
  const configured = Boolean(process.env.SHEETS_PRICE_URL)
  if (!configured) {
    res.json({ configured: false, ok: false, symbolCount: 0, error: 'SHEETS_PRICE_URL yok' })
    return
  }
  const started = Date.now()
  try {
    const prices = await fetchSharePrices(true)
    res.json({
      configured: true,
      ok: Object.keys(prices).length > 0,
      symbolCount: Object.keys(prices).length,
      ms: Date.now() - started,
    })
  } catch (e) {
    res.json({
      configured: true,
      ok: false,
      symbolCount: 0,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    })
  }
})

// GET /api/portfolio/closed — closed positions, newest sell first.
portfolioRouter.get('/closed', async (_req, res) => {
  const closed = await portfolioRepo.getClosedPositions()
  res.json(closed)
})
