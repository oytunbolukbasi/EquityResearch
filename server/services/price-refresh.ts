import { portfolioRepo } from '../db/portfolio-client'
import { portfolioWriteRepo } from '../db/portfolio-write'
import { fetchFundPrice } from './fund-price'
import { fetchSharePrices, PriceSourceUnavailable, registerSymbol } from './price-source'

export interface RefreshResult {
  updated: { symbol: string; price: number }[]
  skipped: { symbol: string; reason: string }[]
  /** Set when the price source itself was unreachable — not the symbols' fault. */
  sourceError?: string
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

  let sheet: Record<string, number>
  try {
    sheet = await fetchSharePrices(force)
  } catch (e) {
    // Report the source failing as exactly that. Listing every position as
    // "not in the price source" would be false and points at the wrong thing.
    if (e instanceof PriceSourceUnavailable) return { ...result, sourceError: e.message }
    throw e
  }

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
      : (
          await fetchSharePrices(force, { attempts: 1 }).catch(
            () => ({}) as Record<string, number>,
          )
        )[position.symbol.toUpperCase()]

  if (price == null) return null
  await writePrice(id, price)
  return price
}

/**
 * Registers a freshly opened position's symbol and then keeps trying to price
 * it — all of it in the background.
 *
 * The registration lives HERE rather than in the route on purpose. It has to
 * happen before the first price read (the sheet only knows the tickers it has
 * rows for), but that ordering is not a reason to make a person wait: the row
 * is already saved, and the sheet answers in ~35s on a good day. Awaiting this
 * pair inside the request handler is exactly what made "Pozisyon ekle" hang for
 * two minutes.
 *
 * Fire-and-forget. Stops at the first success, and stops quietly if the
 * position was deleted meanwhile (refreshOnePrice returns null for a missing id).
 */
export function ensurePriceSoon(
  id: string,
  register?: { symbol: string; type: string },
  // Spaced for a sheet that needs tens of seconds per read and a moment to
  // recalculate a row it was just given — 4/12/30s never once caught it.
  delaysMs: number[] = [3_000, 20_000, 60_000, 120_000],
) {
  void (async () => {
    if (register) await registerSymbol(register.symbol, register.type)
    for (const delay of delaysMs) {
      await new Promise((r) => setTimeout(r, delay))
      const price = await refreshOnePrice(id, true).catch(() => null)
      if (price != null) {
        console.log(`[price] yeni pozisyon fiyatlandi: ${id} → ${price}`)
        return
      }
    }
    console.warn(`[price] yeni pozisyonun fiyati alinamadi: ${id}`)
  })()
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
