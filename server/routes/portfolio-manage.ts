import { Router } from 'express'
import { z } from 'zod'

import { portfolioWriteRepo } from '../db/portfolio-write'
import { requireSession } from '../lib/auth'
import { getHistoricalExchangeRate } from '../services/exchange-rate'
import { ensurePriceSoon, refreshOnePrice, refreshSharePrices } from '../services/price-refresh'

export const portfolioManageRouter = Router()

// Every route below mutates real financial records — session required, no
// exceptions. The admin key stays reserved for the agent's bulk-import.
portfolioManageRouter.use(requireSession)

/**
 * Accepts "1.234,56" (Turkish), "1234.56", or a number, and returns a plain
 * decimal string for Postgres. Values stay strings end to end: the columns are
 * `decimal`, and a float round-trip loses precision on fractional holdings
 * (the live portfolio holds 0.809883524 of one position).
 */
const decimalString = (label: string, { positive = true } = {}) =>
  z.union([z.string(), z.number()]).transform((raw, ctx) => {
    const text = typeof raw === 'number' ? String(raw) : raw.trim()
    // "1.234,56" → "1234.56", but leave "1234.56" alone: a comma means the
    // dots were thousand separators.
    const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      ctx.addIssue({ code: 'custom', message: `${label} sayı olmalı` })
      return z.NEVER
    }
    if (positive && Number(normalized) <= 0) {
      ctx.addIssue({ code: 'custom', message: `${label} sıfırdan büyük olmalı` })
      return z.NEVER
    }
    return normalized
  })

const isoDate = (label: string) =>
  z.string().refine((v) => !Number.isNaN(Date.parse(v)), `${label} geçerli bir tarih olmalı`)

const newPositionInput = z.object({
  symbol: z.string().min(1, 'Varlık kodu gerekli').max(20).trim().toUpperCase(),
  name: z.string().max(200).nullish(),
  type: z.enum(['stock', 'us_stock', 'fund'], { message: 'Varlık türü seçilmeli' }),
  quantity: decimalString('Adet'),
  buyPrice: decimalString('Alış fiyatı'),
  buyDate: isoDate('Alış tarihi'),
  /** Optional override; US positions otherwise get the rate on the buy date. */
  buyRate: decimalString('Kur').optional(),
})

const patchInput = z
  .object({
    name: z.string().max(200).nullish(),
    quantity: decimalString('Adet').optional(),
    buyPrice: decimalString('Alış fiyatı').optional(),
    buyRate: decimalString('Kur').optional(),
    buyDate: isoDate('Alış tarihi').optional(),
    currentPrice: decimalString('Güncel fiyat').optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Değiştirilecek alan yok')

const closeInput = z.object({
  sellPrice: decimalString('Satış fiyatı'),
  sellDate: isoDate('Satış tarihi'),
  /** Omitted = close the whole position. Otherwise a partial sale. */
  quantity: decimalString('Adet').optional(),
})

// POST /api/portfolio/manage/positions — open a new position
portfolioManageRouter.post('/positions', async (req, res) => {
  const parsed = newPositionInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })
    return
  }
  const d = parsed.data

  // US positions are priced in USD but reported in TL, so the rate on the buy
  // date is part of the cost basis. Look it up unless the caller pinned one.
  let buyRate = d.buyRate ?? '1.0'
  if (d.type === 'us_stock' && !d.buyRate) {
    buyRate = String(await getHistoricalExchangeRate(new Date(d.buyDate)))
  }

  const created = await portfolioWriteRepo.createPosition({
    symbol: d.symbol,
    name: d.name ?? null,
    type: d.type,
    quantity: d.quantity,
    buyPrice: d.buyPrice,
    buyRate,
    buyDate: new Date(d.buyDate).toISOString(),
  })

  // Pricing NEVER blocks the write.
  //
  // Registering the symbol and reading the price both talk to a third-party
  // spreadsheet that recalculates ~40 GOOGLEFINANCE cells before answering —
  // measured at ~35s, and it retries when it fails. Awaiting that pair here put
  // roughly a hundred seconds between "Pozisyon ekle" and a response for a row
  // that was already committed, so the button sat on a spinner and the save
  // looked broken. The position is saved; the price catches up on its own.
  ensurePriceSoon(created.id, d.type !== 'fund' ? { symbol: d.symbol, type: d.type } : undefined)

  res.status(201).json({
    ...created,
    /** Tells the client to re-poll instead of showing a blank price. */
    pricePending: true,
  })
})

/**
 * POST /api/portfolio/manage/prices/refresh — the "Fiyatları yenile" button.
 *
 * Shares only, on purpose. A fund's unit price changes once a day and comes
 * from a scraped page against a metered quota, so re-fetching it on every click
 * would spend the quota to re-read a number that cannot have moved. Funds keep
 * the price already stored for them and are refreshed by the morning schedule.
 */
portfolioManageRouter.post('/prices/refresh', async (_req, res) => {
  const result = await refreshSharePrices(true)
  res.json(result)
})

// POST /api/portfolio/manage/positions/:id/refresh-price — one position
portfolioManageRouter.post('/positions/:id/refresh-price', async (req, res) => {
  const price = await refreshOnePrice(req.params.id)
  if (price == null) {
    res.status(404).json({ error: 'price_unavailable' })
    return
  }
  res.json({ price })
})

// PATCH /api/portfolio/manage/positions/:id
portfolioManageRouter.patch('/positions/:id', async (req, res) => {
  const parsed = patchInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })
    return
  }
  const existing = await portfolioWriteRepo.getPosition(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  const p = parsed.data

  // Merge here rather than in SQL — see PositionValues in portfolio-write.ts.
  const updated = await portfolioWriteRepo.updatePosition(req.params.id, {
    name: p.name !== undefined ? (p.name ?? null) : existing.name,
    quantity: p.quantity ?? existing.quantity,
    buyPrice: p.buyPrice ?? existing.buyPrice,
    buyRate: p.buyRate ?? existing.buyRate,
    buyDate: p.buyDate ? new Date(p.buyDate).toISOString() : existing.buyDate,
    currentPrice: p.currentPrice ?? existing.currentPrice,
  })
  res.json(updated)
})

// DELETE /api/portfolio/manage/positions/:id — remove without recording a sale
portfolioManageRouter.delete('/positions/:id', async (req, res) => {
  const ok = await portfolioWriteRepo.deletePosition(req.params.id)
  if (!ok) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ deleted: true })
})

/**
 * POST /api/portfolio/manage/positions/:id/close
 *
 * Sells all or part of a position. A partial sale writes a closed_positions row
 * for the sold quantity and leaves the rest open — no schema change needed,
 * since closed_positions already carries its own quantity.
 *
 * The app this replaces could only ever close a position in full, which is why
 * taking partial profit meant editing rows by hand.
 */
portfolioManageRouter.post('/positions/:id/close', async (req, res) => {
  const parsed = closeInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues })
    return
  }
  const existing = await portfolioWriteRepo.getPosition(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  const held = Number(existing.quantity)
  const sold = parsed.data.quantity != null ? Number(parsed.data.quantity) : held
  if (sold <= 0) {
    res.status(400).json({ error: 'invalid_quantity', message: 'Satılan adet sıfırdan büyük olmalı' })
    return
  }
  // A tiny epsilon keeps "sell everything" working when the typed quantity is a
  // rounded copy of a long fractional holding.
  if (sold > held + 1e-9) {
    res.status(400).json({
      error: 'quantity_exceeds_position',
      message: `Elinizde ${existing.quantity} adet var, ${parsed.data.quantity} satılamaz`,
    })
    return
  }

  const buyPrice = Number(existing.buyPrice)
  const sellPrice = Number(parsed.data.sellPrice)
  const pl = (sellPrice - buyPrice) * sold
  const plPercent = buyPrice !== 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0

  const soldQuantity = parsed.data.quantity ?? existing.quantity
  const closed = await portfolioWriteRepo.insertClosedPosition({
    symbol: existing.symbol,
    name: existing.name,
    type: existing.type,
    quantity: soldQuantity,
    buyPrice: existing.buyPrice,
    buyRate: existing.buyRate,
    sellPrice: parsed.data.sellPrice,
    buyDate: existing.buyDate,
    sellDate: new Date(parsed.data.sellDate).toISOString(),
    pl: pl.toFixed(2),
    plPercent: plPercent.toFixed(2),
  })

  const remaining = held - sold
  const fullyClosed = remaining <= 1e-9
  if (fullyClosed) {
    await portfolioWriteRepo.deletePosition(req.params.id)
  } else {
    // Derive the remainder from the stored string so a full-precision holding
    // doesn't get truncated by the float subtraction above.
    await portfolioWriteRepo.reduceQuantity(req.params.id, String(remaining))
  }

  res.status(201).json({ closedId: closed.id, fullyClosed, remaining: fullyClosed ? '0' : String(remaining) })
})

// DELETE /api/portfolio/manage/closed-positions/:id
portfolioManageRouter.delete('/closed-positions/:id', async (req, res) => {
  const ok = await portfolioWriteRepo.deleteClosedPosition(req.params.id)
  if (!ok) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ deleted: true })
})
