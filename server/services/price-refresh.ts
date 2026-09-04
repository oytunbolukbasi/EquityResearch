import { portfolioRepo } from '../db/portfolio-client'
import { portfolioWriteRepo } from '../db/portfolio-write'
import { fetchFundPrice } from './fund-price'
import { fetchSharePrices } from './price-source'

export interface RefreshResult {
  updated: { symbol: string; price: number }[]
  skipped: { symbol: string; reason: string }[]
}

/**
 * Shares and funds refresh on completely different rhythms, so they are two
 * separate jobs — see price-scheduler.ts.
 *
 * A symbol with no price is SKIPPED, never zeroed: an unreachable source must
 * not be able to wipe a figure the rest of the panel depends on.
 */

/** BIST + US positions. Cheap: one request covers every symbol. */
export async function refreshSharePrices(force = false): Promise<RefreshResult> {
  const shares = (await portfolioRepo.getOpenPositions()).filter((p) => p.type !== 'fund')
  const result: RefreshResult = { updated: [], skipped: [] }
  if (shares.length === 0) return result

  const sheet = await fetchSharePrices(force)
  for (const p of shares) {
    const price = sheet[p.symbol.toUpperCase()]
    if (price == null) {
      result.skipped.push({ symbol: p.symbol, reason: 'fiyat kaynağında yok' })
      continue
    }
    await writePrice(p.id, price)
    result.updated.push({ symbol: p.symbol, price })
  }
  return result
}

/**
 * TEFAS funds. Expensive: one scraped page per fund against a metered
 * ScraperAPI quota, which is why this runs on a schedule rather than a timer.
 */
export async function refreshFundPrices(force = false): Promise<RefreshResult> {
  const funds = (await portfolioRepo.getOpenPositions()).filter((p) => p.type === 'fund')
  const result: RefreshResult = { updated: [], skipped: [] }

  // Sequential on purpose — parallel scrapes burn quota faster and are more
  // likely to trip rate limiting.
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

/** Both at once — what the manual "Fiyatları yenile" button runs. */
export async function refreshAllPrices(force = false): Promise<RefreshResult> {
  const shares = await refreshSharePrices(force)
  const funds = await refreshFundPrices(force)
  return {
    updated: [...shares.updated, ...funds.updated],
    skipped: [...shares.skipped, ...funds.skipped],
  }
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
