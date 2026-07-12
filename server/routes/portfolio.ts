import { Router } from 'express'
import { desc } from 'drizzle-orm'

import { db } from '../db/client'
import { portfolioInsights } from '../db/schema'
import { portfolioRepo } from '../db/portfolio-client'
import { getExchangeRate } from '../services/exchange-rate'

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
  const [positions, { rate: usdTryRate, isFallback: usdTryRateIsFallback }] = await Promise.all([
    portfolioRepo.getOpenPositions(),
    getExchangeRate('USDTRY'),
  ])

  const enriched = positions.map((p) => {
    const costBasis = p.quantity * p.buyPrice
    const currentValue = p.currentPrice != null ? p.quantity * p.currentPrice : null
    const plAmount = currentValue != null ? currentValue - costBasis : null
    const plPercent = plAmount != null && costBasis !== 0 ? (plAmount / costBasis) * 100 : null

    // TL equivalents only make sense for us_stock (priced in USD). buyRate is
    // the USD/TRY rate at purchase time, so costBasisTRY is exact using it.
    // currentValueTRY uses today's live rate (usdTryRate) instead, since the
    // position is still open and its TL worth today isn't the purchase-time
    // rate.
    const isUsStock = p.type === 'us_stock'
    const costBasisTRY = isUsStock && p.buyRate != null ? costBasis * p.buyRate : null
    const currentValueTRY = isUsStock && currentValue != null ? currentValue * usdTryRate : null

    return {
      ...p,
      costBasis,
      currentValue,
      plAmount,
      plPercent,
      costBasisTRY,
      currentValueTRY,
    }
  })

  res.json({ positions: enriched, usdTryRate, usdTryRateIsFallback })
})

// GET /api/portfolio/closed — closed positions, newest sell first.
portfolioRouter.get('/closed', async (_req, res) => {
  const closed = await portfolioRepo.getClosedPositions()
  res.json(closed)
})
