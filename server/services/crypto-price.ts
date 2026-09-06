/**
 * Crypto prices, in USD, from CoinGecko's public API.
 *
 * No key and no account: the free endpoint answers every symbol the panel holds
 * in a single request, which is all "show me the current price when I open the
 * panel" needs. Alpaca was the obvious candidate — the panel already has keys
 * for it — but it does not list XAUT (checked: 73 crypto symbols, not among
 * them), and running two sources for two positions is worse than running one.
 */

/**
 * Symbol → CoinGecko id.
 *
 * Curated rather than resolved from CoinGecko's symbol index on purpose: dozens
 * of coins share a ticker there, so looking "SOL" up by symbol can silently
 * return a different asset. Adding a coin means adding a line here — a small
 * cost, paid once, for never pricing the wrong thing.
 */
const COINGECKO_IDS: Record<string, string> = {
  SOL: 'solana',
  XAUT: 'tether-gold',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  PAXG: 'pax-gold',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  ADA: 'cardano',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
}

/** Same guard as the share sheet: a burst of refresh clicks is one request. */
const CACHE_TTL_MS = 60_000

let cache: { at: number; prices: Record<string, number> } | null = null

export class CryptoSourceUnavailable extends Error {
  constructor(cause: unknown) {
    super(`Kripto fiyat kaynağına ulaşılamadı: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'CryptoSourceUnavailable'
  }
}

/** Symbols the panel can price. Anything else is reported, never guessed. */
export function isKnownCryptoSymbol(symbol: string): boolean {
  return symbol.toUpperCase() in COINGECKO_IDS
}

/**
 * USD price per unit, keyed by upper-case symbol.
 *
 * Throws `CryptoSourceUnavailable` rather than returning `{}` — the same rule
 * the share source follows, so a dead source is never mistaken for "none of
 * your symbols are tracked".
 */
export async function fetchCryptoPrices(
  symbols: string[],
  force = false,
): Promise<Record<string, number>> {
  const wanted = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(
    (s) => s in COINGECKO_IDS,
  )
  if (wanted.length === 0) return {}

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    if (wanted.every((s) => s in cache!.prices)) return cache.prices
  }

  const ids = wanted.map((s) => COINGECKO_IDS[s]).join(',')
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = (await res.json()) as Record<string, { usd?: number }>

    const prices: Record<string, number> = {}
    for (const symbol of wanted) {
      const usd = raw[COINGECKO_IDS[symbol]]?.usd
      // A price of 0 is not a price; drop it rather than store it.
      if (typeof usd === 'number' && Number.isFinite(usd) && usd > 0) prices[symbol] = usd
    }
    if (Object.keys(prices).length === 0) throw new Error('kaynak boş döndü')

    cache = { at: Date.now(), prices }
    return prices
  } catch (e) {
    // Stale prices were real; they beat failing outright.
    if (cache) {
      console.warn('[crypto] kaynak yanıt vermedi, önbellekteki fiyatlar kullanılıyor —', e)
      return cache.prices
    }
    console.error('[crypto] fiyatlar alınamadı —', e)
    throw new CryptoSourceUnavailable(e)
  }
}
