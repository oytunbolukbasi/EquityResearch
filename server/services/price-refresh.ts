import { portfolioRepo } from '../db/portfolio-client'
import { portfolioWriteRepo } from '../db/portfolio-write'
import { fetchFundPrice } from './fund-price'
import { fetchSharePrices } from './price-source'

export interface RefreshResult {
  updated: { symbol: string; price: number }[]
  skipped: { symbol: string; reason: string }[]
}

/**
 * Refreshes `current_price` for every open position.
 *
 * This is the job the PortfoyTakip app used to run. Once it lives here, that
 * app can be switched off — and until it does, prices freeze silently and the
 * whole panel (KPI cards, P/L, the daily note) quietly shows stale numbers.
 *
 * A symbol with no price is SKIPPED, never zeroed: an unreachable source must
 * not be able to wipe a figure the rest of the panel depends on.
 */
export async function refreshAllPrices(force = false): Promise<RefreshResult> {
  const positions = await portfolioRepo.getOpenPositions()
  const result: RefreshResult = { updated: [], skipped: [] }
  if (positions.length === 0) return result

  const shares = positions.filter((p) => p.type !== 'fund')
  const funds = positions.filter((p) => p.type === 'fund')

  // One request covers every share; the sheet returns the whole tracked set.
  const sheet = shares.length > 0 ? await fetchSharePrices(force) : {}

  for (const p of shares) {
    const price = sheet[p.symbol.toUpperCase()]
    if (price == null) {
      result.skipped.push({ symbol: p.symbol, reason: 'fiyat kaynağında yok' })
      continue
    }
    await writePrice(p.id, price)
    result.updated.push({ symbol: p.symbol, price })
  }

  // Funds are scraped one page at a time, so they run sequentially to stay
  // gentle on the ScraperAPI quota.
  for (const p of funds) {
    const price = await fetchFundPrice(p.symbol, force)
    if (price == null) {
      result.skipped.push({ symbol: p.symbol, reason: 'fon fiyatı alınamadı' })
      continue
    }
    await writePrice(p.id, price)
    result.updated.push({ symbol: p.symbol, price })
  }

  return result
}

/** Refreshes one position; returns the new price, or null if unresolved. */
export async function refreshOnePrice(id: string, force = true): Promise<number | null> {
  const position = await portfolioWriteRepo.getPosition(id)
  if (!position) return null

  const price =
    position.type === 'fund'
      ? await fetchFundPrice(position.symbol, force)
      : (await fetchSharePrices(force))[position.symbol.toUpperCase()]

  if (price == null) return null
  await writePrice(id, price)
  return price
}

async function writePrice(id: string, price: number) {
  const existing = await portfolioWriteRepo.getPosition(id)
  if (!existing) return
  await portfolioWriteRepo.updatePosition(id, {
    name: existing.name,
    quantity: existing.quantity,
    buyPrice: existing.buyPrice,
    buyRate: existing.buyRate,
    buyDate: existing.buyDate,
    // 6 decimals matches the column and keeps fund unit prices exact.
    currentPrice: price.toFixed(6),
  })
}
