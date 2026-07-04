import { Router } from 'express'

import { portfolioRepo } from '../db/portfolio-client'

export const portfolioRouter = Router()

// GET /api/portfolio/summary — open positions with derived P/L + last 30
// days of portfolio snapshots. Read-only against the separate portfolio DB.
portfolioRouter.get('/summary', async (_req, res) => {
  const [positions, snapshots] = await Promise.all([
    portfolioRepo.getOpenPositions(),
    portfolioRepo.getRecentSnapshots(30),
  ])

  const enriched = positions.map((p) => {
    const costBasis = p.quantity * p.buyPrice
    const currentValue = p.currentPrice != null ? p.quantity * p.currentPrice : null
    const plAmount = currentValue != null ? currentValue - costBasis : null
    const plPercent = plAmount != null && costBasis !== 0 ? (plAmount / costBasis) * 100 : null

    // TL equivalents only make sense for us_stock (priced in USD). buyRate is
    // the USD/TRY rate at purchase time, so costBasisTRY is exact. We don't
    // have a current USD/TRY rate on hand, so currentValueTRY stays null —
    // the frontend should show a "requires a live FX rate" note instead of
    // guessing.
    const isUsStock = p.type === 'us_stock'
    const costBasisTRY = isUsStock && p.buyRate != null ? costBasis * p.buyRate : null
    const currentValueTRY: number | null = null

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

  res.json({ positions: enriched, snapshots })
})

// GET /api/portfolio/closed — closed positions, newest sell first.
portfolioRouter.get('/closed', async (_req, res) => {
  const closed = await portfolioRepo.getClosedPositions()
  res.json(closed)
})
