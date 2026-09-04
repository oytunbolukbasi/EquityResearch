/**
 * TEFAS fund prices, scraped from fintables.com.
 *
 * Funds are the one asset class with no clean feed: TEFAS has no public API and
 * the Google Sheet's GOOGLEFINANCE rows don't cover Turkish funds. The
 * PortfoyTakip app solved this by scraping Fintables through ScraperAPI, and
 * that arrangement is carried over here unchanged.
 *
 * Fund prices move once a day, so a single successful fetch is cached for the
 * rest of the Turkish calendar day — that keeps the ScraperAPI free-tier quota
 * for the two scheduled runs rather than burning it on refresh clicks.
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

/** Today's price for one fund, or null when it can't be resolved. */
export async function fetchFundPrice(symbol: string, force = false): Promise<number | null> {
  const upper = symbol.toUpperCase()
  if (!force) {
    const cached = getCached(upper)
    if (cached != null) return cached
  }

  try {
    const html = await fetchViaProxy(`https://fintables.com/fonlar/${upper}`)
    const price = extractPrice(html)
    if (price != null) {
      cache.set(upper, { price, fetchedAt: new Date() })
      return price
    }
    console.warn(`[fund] ${upper}: price not found in page`)
  } catch (e) {
    console.warn(`[fund] ${upper}: fetch failed —`, e)
  }
  // Stale beats blank: an older cached figure is closer to the truth than
  // wiping the stored price would be.
  return cache.get(upper)?.price ?? null
}
