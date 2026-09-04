// Fallback used only when the live rate can't be fetched — an approximate
// USD/TRY level, not meant to be precise. Callers should surface
// `isFallback` to the user rather than presenting this as a live quote.
const FALLBACK_USDTRY = 41.5

export interface ExchangeRateResult {
  rate: number
  isFallback: boolean
}

/**
 * Live USD/TRY rate via Frankfurter (ECB-sourced, no API key required).
 * `pair` is accepted for future flexibility but only 'USDTRY' is wired up.
 */
export async function getExchangeRate(pair: string = 'USDTRY'): Promise<ExchangeRateResult> {
  if (pair !== 'USDTRY') {
    return { rate: FALLBACK_USDTRY, isFallback: true }
  }
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { rates?: { TRY?: number } }
    const rate = data?.rates?.TRY
    if (typeof rate !== 'number' || !Number.isFinite(rate)) throw new Error('malformed response')
    return { rate, isFallback: false }
  } catch (e) {
    console.warn('getExchangeRate: falling back to static USD/TRY rate —', e)
    return { rate: FALLBACK_USDTRY, isFallback: true }
  }
}

/**
 * USD/TRY on a specific date, used to fix a US position's cost basis in lira at
 * the moment it was bought.
 *
 * Frankfurter answers a weekend or holiday with the previous published rate, so
 * a Saturday buy date resolves to Friday's close rather than failing. Falls
 * back to today's live rate, then to the static level.
 */
export async function getHistoricalExchangeRate(date: Date): Promise<number> {
  const day = date.toISOString().slice(0, 10)
  try {
    const response = await fetch(`https://api.frankfurter.app/${day}?from=USD&to=TRY`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as { rates?: { TRY?: number } }
    const rate = data?.rates?.TRY
    if (typeof rate !== 'number' || !Number.isFinite(rate)) throw new Error('malformed response')
    return rate
  } catch (e) {
    console.warn(`getHistoricalExchangeRate(${day}): falling back to the live rate —`, e)
    return (await getExchangeRate('USDTRY')).rate
  }
}
