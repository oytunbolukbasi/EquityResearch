import { Router, type Response } from 'express'

import { AlpacaError, alpacaFetch } from '../lib/alpaca'
import { requireAdmin } from '../middleware/require-admin'

export const paperTradingRouter = Router()

// ─── types ────────────────────────────────────────────────────────────────────

interface AlpacaFillActivity {
  id: string
  activity_type: string
  transaction_time: string
  type: 'fill' | 'partial_fill'
  qty: string
  price: string
  side: 'buy' | 'sell'
  symbol: string
}

export interface ClosedPaperPosition {
  symbol: string
  qty: number
  entryPrice: number
  exitPrice: number
  pl: number
  plPct: number
  closedAt: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function sendAlpacaError(err: unknown, res: Response) {
  if (err instanceof AlpacaError) {
    res.status(err.statusCode).json({ error: err.message })
  } else {
    res.status(500).json({ error: err instanceof Error ? err.message : 'alpaca_error' })
  }
}

// Pairs buy FILL activities with sell FILL activities for the same symbol using
// FIFO. Unmatched buys (still open) are ignored. Returns newest-first.
function computeClosedPositions(activities: AlpacaFillActivity[]): ClosedPaperPosition[] {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.transaction_time).getTime() - new Date(b.transaction_time).getTime(),
  )

  const buyQueues = new Map<string, AlpacaFillActivity[]>()
  const closed: ClosedPaperPosition[] = []

  for (const fill of sorted) {
    if (fill.side === 'buy') {
      if (!buyQueues.has(fill.symbol)) buyQueues.set(fill.symbol, [])
      buyQueues.get(fill.symbol)!.push(fill)
    } else if (fill.side === 'sell') {
      const buyFill = buyQueues.get(fill.symbol)?.shift()
      if (buyFill) {
        const entryPrice = parseFloat(buyFill.price)
        const exitPrice = parseFloat(fill.price)
        const qty = parseFloat(fill.qty)
        const pl = (exitPrice - entryPrice) * qty
        const plPct = entryPrice > 0 ? (pl / (entryPrice * qty)) * 100 : 0
        closed.push({ symbol: fill.symbol, qty, entryPrice, exitPrice, pl, plPct, closedAt: fill.transaction_time })
      }
    }
  }

  return closed.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
}

// ─── routes ───────────────────────────────────────────────────────────────────

// GET /api/paper-trading/account
paperTradingRouter.get('/account', async (_req, res) => {
  try {
    const data = await alpacaFetch('/v2/account')
    res.json(data)
  } catch (e) {
    sendAlpacaError(e, res)
  }
})

// GET /api/paper-trading/positions
paperTradingRouter.get('/positions', async (_req, res) => {
  try {
    const data = await alpacaFetch('/v2/positions')
    res.json(data ?? [])
  } catch (e) {
    sendAlpacaError(e, res)
  }
})

// GET /api/paper-trading/orders?status=open|closed
paperTradingRouter.get('/orders', async (req, res) => {
  try {
    const status = req.query.status === 'closed' ? 'closed' : 'open'
    const qs = status === 'closed'
      ? '?status=closed&limit=100&direction=desc'
      : '?status=open&limit=100'
    const data = await alpacaFetch(`/v2/orders${qs}`)
    res.json(data ?? [])
  } catch (e) {
    sendAlpacaError(e, res)
  }
})

// POST /api/paper-trading/orders (admin)
paperTradingRouter.post('/orders', requireAdmin, async (req, res) => {
  try {
    const data = await alpacaFetch('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(req.body),
    })
    res.status(201).json(data)
  } catch (e) {
    sendAlpacaError(e, res)
  }
})

// DELETE /api/paper-trading/orders/:orderId (admin)
paperTradingRouter.delete('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    await alpacaFetch(`/v2/orders/${req.params.orderId}`, { method: 'DELETE' })
    res.status(204).send()
  } catch (e) {
    sendAlpacaError(e, res)
  }
})

// GET /api/paper-trading/closed-positions
// Fetches FILL activities and pairs buys with sells via FIFO to produce closed P&L rows.
paperTradingRouter.get('/closed-positions', async (_req, res) => {
  try {
    const activities = await alpacaFetch<AlpacaFillActivity[]>(
      '/v2/account/activities/FILL?page_size=100&direction=desc',
    )
    res.json(computeClosedPositions(activities ?? []))
  } catch (e) {
    sendAlpacaError(e, res)
  }
})
