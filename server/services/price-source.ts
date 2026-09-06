import { sheetSymbol } from '../../shared/asset-types'

/**
 * Share prices for BIST and US positions.
 *
 * The source is a Google Sheet fronted by an Apps Script web app: the sheet
 * holds one GOOGLEFINANCE row per tracked symbol and the script returns them as
 * `{ SYMBOL: price }`. It is the same source the PortfoyTakip app used, and it
 * runs independently of that app — which is exactly why it can be adopted here
 * and keep working after that app is retired.
 *
 * Funds are not here: TEFAS prices aren't in the sheet, see fund-price.ts.
 */

/** Cheap guard against hammering the script on a burst of refresh clicks. */
const CACHE_TTL_MS = 60_000

/**
 * The Apps Script recalculates ~40 GOOGLEFINANCE cells before it answers and
 * has been measured at ~35s. A 30s ceiling turned every read into a timeout
 * even though the sheet was perfectly healthy.
 */
const DEFAULT_TIMEOUT_MS = 60_000

let cache: { at: number; prices: Record<string, number> } | null = null

/**
 * The read currently in flight, if any.
 *
 * Apps Script serves one request at a time per script, so two overlapping reads
 * do not go twice as fast — they queue, and at ~35s each the second one times
 * out waiting for the first. Callers share a single read instead. (This is the
 * collision that made a symbol registration and a refresh knock each other out.)
 */
let inFlight: Promise<Record<string, number>> | null = null

function sheetsUrl(): string | null {
  const url = process.env.SHEETS_PRICE_URL
  if (!url) {
    console.warn('SHEETS_PRICE_URL is not set — share prices cannot be refreshed.')
    return null
  }
  return url
}

/**
 * Every tracked symbol and its latest price, or an empty map when the source is
 * unreachable. Callers must treat "missing symbol" as "leave the stored price
 * alone" — writing null would blank a price the panel depends on.
 */
/**
 * How hard to try. Retries are a CALLER's decision, not a fixed policy: three
 * 60s attempts is right for a background sweep and catastrophic anywhere near a
 * request a person is waiting on.
 */
export interface FetchOptions {
  attempts?: number
  timeoutMs?: number
}

/** Thrown when the sheet could not be read at all and no cache can stand in. */
export class PriceSourceUnavailable extends Error {
  constructor(cause: unknown) {
    super(`Fiyat kaynağına ulaşılamadı: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'PriceSourceUnavailable'
  }
}

async function readSheet(url: string, timeoutMs: number): Promise<Record<string, number>> {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = (await res.json()) as Record<string, unknown>

  const prices: Record<string, number> = {}
  for (const [symbol, value] of Object.entries(raw)) {
    const n = typeof value === 'number' ? value : Number(value)
    // A symbol the sheet hasn't resolved yet comes back as 0 or a string like
    // "#N/A"; both must be dropped rather than stored as a price.
    if (Number.isFinite(n) && n > 0) prices[symbol.toUpperCase()] = n
  }
  if (Object.keys(prices).length === 0) throw new Error('sheet boş döndü')
  return prices
}

/**
 * Throws `PriceSourceUnavailable` rather than returning an empty map.
 *
 * Returning `{}` made a dead source indistinguishable from "none of your
 * symbols are tracked": every position got skipped with "fiyat kaynağında yok",
 * which blames the symbols for the source being down. Callers need to be able
 * to tell those apart to say anything true about it.
 *
 * Apps Script serves one request at a time per script, so a burst — registering
 * a new symbol while a refresh is in flight — can fail transiently. Retried
 * twice with a short backoff before giving up.
 */
export async function fetchSharePrices(
  force = false,
  { attempts = 3, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<Record<string, number>> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.prices

  const url = sheetsUrl()
  if (!url) throw new PriceSourceUnavailable('SHEETS_PRICE_URL tanımlı değil')

  if (inFlight) return inFlight
  inFlight = read(url, attempts, timeoutMs).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function read(
  url: string,
  attempts: number,
  timeoutMs: number,
): Promise<Record<string, number>> {
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const prices = await readSheet(url, timeoutMs)
      cache = { at: Date.now(), prices }
      return prices
    } catch (e) {
      last = e
      console.warn(`[price] sheet okunamadı (deneme ${attempt}/${attempts}) —`, e)
      if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 1_500))
    }
  }

  // A stale cache still beats failing outright — those prices were real.
  if (cache) {
    console.warn('[price] kaynak yanıt vermedi, önbellekteki fiyatlar kullanılıyor')
    return cache.prices
  }
  console.error('[price] hisse fiyatları alınamadı —', last)
  throw new PriceSourceUnavailable(last)
}

/**
 * Tells the sheet to start tracking a symbol.
 *
 * Without this a newly opened position has no price until the symbol is added
 * by hand: the sheet only knows the tickers it has rows for. Fire-and-forget —
 * a failure here must not stop the position from being saved, and the next
 * refresh picks the price up once the row exists.
 */
export async function registerSymbol(symbol: string, type: string): Promise<void> {
  const url = sheetsUrl()
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Qualified for the cell ("FRA:SAP"); the sheet answers keyed bare.
      body: JSON.stringify({ symbol: sheetSymbol(symbol, type), type, action: 'register' }),
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    console.warn(`registerSymbol(${symbol}) failed — price will be missing until added:`, e)
  }
}
