/**
 * Foreign-exchange rates against the lira, via Frankfurter (ECB-sourced, no API
 * key). Every non-TRY position's value has to pass through here before it can
 * be reported in the panel's own currency.
 */

/** The currencies a position can be priced in. */
export type Currency = 'TRY' | 'USD' | 'EUR'

/**
 * Used only when the live rate can't be fetched — approximate levels, not
 * quotes. Callers surface `isFallback` rather than presenting these as live.
 */
const FALLBACK: Record<Exclude<Currency, 'TRY'>, number> = {
  USD: 41.5,
  EUR: 48.0,
}

export interface ExchangeRateResult {
  rate: number
  isFallback: boolean
}

async function frankfurter(path: string, from: string): Promise<number> {
  const response = await fetch(`https://api.frankfurter.app/${path}?from=${from}&to=TRY`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as { rates?: { TRY?: number } }
  const rate = data?.rates?.TRY
  if (typeof rate !== 'number' || !Number.isFinite(rate)) throw new Error('malformed response')
  return rate
}

/** Live <currency>/TRY. TRY itself is 1 and never hits the network. */
export async function getExchangeRate(currency: Currency = 'USD'): Promise<ExchangeRateResult> {
  if (currency === 'TRY') return { rate: 1, isFallback: false }
  try {
    return { rate: await frankfurter('latest', currency), isFallback: false }
  } catch (e) {
    console.warn(`getExchangeRate(${currency}): falling back to a static level —`, e)
    return { rate: FALLBACK[currency], isFallback: true }
  }
}

/**
 * Every rate the panel needs, in one shot.
 *
 * Fetched together because the summary endpoint needs all of them and a
 * position's currency is not known until the rows are read — asking per
 * position would mean one request per row.
 */
export async function getRates(): Promise<{
  rates: Record<Currency, number>
  fallback: Currency[]
}> {
  const [usd, eur] = await Promise.all([getExchangeRate('USD'), getExchangeRate('EUR')])
  const fallback: Currency[] = []
  if (usd.isFallback) fallback.push('USD')
  if (eur.isFallback) fallback.push('EUR')
  return { rates: { TRY: 1, USD: usd.rate, EUR: eur.rate }, fallback }
}

/**
 * <currency>/TRY on a specific date, used to fix a foreign position's cost
 * basis in lira at the moment it was bought.
 *
 * Frankfurter answers a weekend or holiday with the previous published rate, so
 * a Saturday buy date resolves to Friday's close rather than failing. Falls
 * back to today's live rate, then to the static level.
 */
export async function getHistoricalExchangeRate(
  date: Date,
  currency: Currency = 'USD',
): Promise<number> {
  if (currency === 'TRY') return 1
  const day = date.toISOString().slice(0, 10)
  try {
    return await frankfurter(day, currency)
  } catch (e) {
    console.warn(`getHistoricalExchangeRate(${day}, ${currency}): using the live rate —`, e)
    return (await getExchangeRate(currency)).rate
  }
}
