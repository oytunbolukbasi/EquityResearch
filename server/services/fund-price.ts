/**
 * TEFAS fund prices, read from TEFAS itself.
 *
 * This file used to open with "TEFAS has no public API" — true when it was
 * written, and the reason the price came the long way round: scrape
 * fintables.com (which resells TEFAS data) through ScraperAPI. TEFAS has since
 * rebuilt its site as a Next.js app whose own pages call a plain JSON endpoint,
 * so the primary source is now reachable directly.
 *
 * What that removes: an API key, a metered quota, and a middleman. On
 * 14 Eylül 2026 Fintables blocked ScraperAPI at both fund slots — ScraperAPI
 * retried 45 and 46 times, returned HTTP 500 each time, and the panel carried a
 * three-day-old price. The same figure came back from TEFAS in 0,19 s with no
 * credentials at all, and its 11 Eylül value matched our stored 0,892774
 * exactly — which is also the proof that Fintables was reselling this data.
 *
 * Fintables is kept as a fallback, not deleted: one source is not a supply.
 * It runs only when TEFAS fails, and it says so in the log when it does.
 *
 * Fund prices move once a day, so a successful fetch is cached for the rest of
 * the Turkish calendar day.
 */

interface CacheEntry {
  price: number
  fetchedAt: Date
}

const cache = new Map<string, CacheEntry>()

/** Turkey is UTC+3 year-round, so a fixed offset is exact here. */
function turkishDayKey(d: Date): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function getCached(symbol: string): number | null {
  const entry = cache.get(symbol)
  if (!entry) return null
  return turkishDayKey(entry.fetchedAt) === turkishDayKey(new Date()) ? entry.price : null
}

export function cachedFundPrices(): { symbol: string; price: number; fetchedAt: string }[] {
  return [...cache.entries()].map(([symbol, e]) => ({
    symbol,
    price: e.price,
    fetchedAt: e.fetchedAt.toISOString(),
  }))
}

const TEFAS_URL = 'https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir'
/** The site's own "Haftalık" tab — a handful of rows, enough to read the last one. */
const TEFAS_PERIOD_WEEK = 13

interface TefasRow {
  fonKodu: string
  tarih: string
  fiyat: number
}

/**
 * The latest published unit price for a fund, straight from TEFAS.
 *
 * Returns the LAST row rather than filtering for today: a fund's price is
 * published with a lag and never on a weekend, so "the most recent one TEFAS
 * has" is the only answer that is always right. How fresh our copy is, is
 * already recorded by `last_updated` on the position.
 *
 * No Authorization header: the site sends a bearer token, and the endpoint was
 * measured to answer identically without it. Sending a token copied out of
 * someone else's page would be borrowing a credential we were never issued.
 */
async function fetchFromTefas(code: string): Promise<number | null> {
  try {
    const res = await fetch(TEFAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fonKodu: code, dil: 'TR', periyod: TEFAS_PERIOD_WEEK }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const body = (await res.json()) as { errorMessage?: string | null; resultList?: TefasRow[] }
    if (body.errorMessage) throw new Error(body.errorMessage)

    const rows = (body.resultList ?? [])
      .filter((r) => r.fonKodu === code && Number.isFinite(r.fiyat) && r.fiyat > 0)
      .sort((a, b) => a.tarih.localeCompare(b.tarih))
    const last = rows[rows.length - 1]
    if (!last) throw new Error('resultList boş')

    console.log(`[fund] ${code}: TEFAS ${last.tarih} → ${last.fiyat}`)
    return last.fiyat
  } catch (e) {
    console.warn(`[fund] ${code}: TEFAS okunamadı —`, e)
    return null
  }
}

/**
 * ScraperAPI is deliberately limited to Fintables URLs. The free plan has a
 * small monthly quota, and a stray call for anything else would silently spend
 * it — the old app hit exactly this and added the same guard.
 */
async function fetchViaProxy(targetUrl: string): Promise<string> {
  if (!targetUrl.startsWith('https://fintables.com/')) {
    throw new Error('ScraperAPI is restricted to Fintables fund URLs')
  }

  const apiKey = process.env.SCRAPER_API_KEY
  const url = apiKey
    ? `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`
    : targetUrl

  if (!apiKey) {
    console.warn('SCRAPER_API_KEY is not set — trying Fintables directly (often blocked).')
  }

  const res = await fetch(url, {
    headers: { 'Accept-Language': 'tr-TR,tr;q=0.9' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/**
 * Fintables renders the fund page from an embedded JSON payload, so the price
 * is read out of that stream rather than out of the DOM — the markup changes
 * far more often than the payload shape does.
 */
function extractPrice(html: string): number | null {
  const match = /"price\\?":\s*([\d.]+)/.exec(html)
  if (!match) return null
  const price = Number(match[1])
  // Fund unit prices sit well under 10000; anything outside that is a parse
  // artefact (a timestamp, an id) rather than a price.
  return Number.isFinite(price) && price > 0 && price < 10_000 ? price : null
}

/** One fund's price, or null when it can't be resolved at all. */
export interface FundPrice {
  price: number
  /** True when the scrape failed and this came from an earlier fetch. */
  stale: boolean
}

/**
 * Today's price for one fund.
 *
 * A cache hit inside the day's TTL is NOT stale — the scrape succeeded, and a
 * fund's unit price only moves once a day. `stale` marks the other case: the
 * scrape failed and this is the last figure we managed to read.
 */
export async function fetchFundPrice(symbol: string, force = false): Promise<FundPrice | null> {
  const upper = symbol.toUpperCase()
  if (!force) {
    const cached = getCached(upper)
    if (cached != null) return { price: cached, stale: false }
  }

  const direct = await fetchFromTefas(upper)
  if (direct != null) {
    cache.set(upper, { price: direct, fetchedAt: new Date() })
    return { price: direct, stale: false }
  }

  // Only now the paid, metered path.
  console.warn(`[fund] ${upper}: TEFAS başarısız — Fintables'a düşülüyor`)
  try {
    const html = await fetchViaProxy(`https://fintables.com/fonlar/${upper}`)
    const price = extractPrice(html)
    if (price != null) {
      cache.set(upper, { price, fetchedAt: new Date() })
      return { price, stale: false }
    }
    console.warn(`[fund] ${upper}: price not found in page`)
  } catch (e) {
    console.warn(`[fund] ${upper}: fetch failed —`, e)
  }
  // Stale beats blank: an older cached figure is closer to the truth than
  // wiping the stored price would be — but it must say so.
  const fallback = cache.get(upper)?.price
  return fallback == null ? null : { price: fallback, stale: true }
}
