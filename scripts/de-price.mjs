/**
 * Frankfurt (XETRA) fiyatları — anahtarsız.
 *
 *   node scripts/de-price.mjs MBG VOW3 SAP ENR DTE
 *
 * İçerik turunda Almanya tarafının fiyat kaynağı budur (talimatname ADIM 1).
 * Panelin KENDİ fiyat hattı bu değil; o Google E-Tablosu'ndan gelir ve
 * portföy satırlarını o besler. Bu betik içerik üretirken okumak içindir:
 * seviye kontrolü (zarar kesme/hedef) ve bültendeki rakamlar.
 *
 * Neden bu uç:
 * - Twelve Data'nın ücretsiz planı XETRA sembollerinin neredeyse tamamını
 *   kapatıyor (VOW3 hariç; MBG, MUV2, DBK, ALV "Grow plan" istiyor).
 * - Stooq'un CSV ucu artık tarayıcı doğrulaması (JavaScript proof-of-work)
 *   istiyor — bot korumasıdır, aşılmaz.
 * - yfinance MCP'si Alman sembollerinde şemaya takılıyor: GÜNLÜK barların son
 *   iki günü `null` geliyor ve sunucu tüm yanıtı reddediyor. Veri aslında
 *   orada; sorun son barın boş olması.
 *
 * Bu yüzden GÜNLÜK bar istemiyoruz: aynı uçta `meta.regularMarketPrice`
 * son seansın fiyatını taşıyor ve güncel. Doğrulandı — Volkswagen için bu
 * yolla gelen 76,52 €, ücretli kaynağın (Twelve Data) 18 Eylül kapanışıyla
 * birebir aynı.
 */

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart'

/** Panelde ticker'lar çıplak saklanır; sorgu için borsa uzantısı eklenir. */
const suffixed = (t) => (t.includes('.') ? t : `${t}.DE`)

async function fetchOne(ticker) {
  const url = `${YAHOO}/${encodeURIComponent(suffixed(ticker))}?range=1d&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  if (body?.chart?.error) throw new Error(body.chart.error.description ?? 'chart error')
  const meta = body?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  // Fiyatı olmayan sembol ATLANIR, sıfırlanmaz — fiyat hattının kuralı burada
  // da geçerli: ulaşılamayan bir kaynak bir rakamı silemez.
  if (typeof price !== 'number') throw new Error('meta.regularMarketPrice yok')
  return {
    ticker,
    price,
    currency: meta.currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    at: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
  }
}

const tickers = process.argv.slice(2)
if (!tickers.length) {
  console.error('Kullanım: node scripts/de-price.mjs MBG VOW3 SAP ENR DTE')
  process.exit(1)
}

const results = await Promise.all(
  tickers.map((t) => fetchOne(t).catch((e) => ({ ticker: t, error: String(e.message ?? e) }))),
)

for (const r of results) {
  if (r.error) {
    console.log(`${r.ticker.padEnd(6)} — ALINAMADI: ${r.error}`)
    continue
  }
  const chg =
    typeof r.previousClose === 'number' ? ((r.price / r.previousClose - 1) * 100).toFixed(2) : '—'
  console.log(
    `${r.ticker.padEnd(6)} ${String(r.price).padStart(9)} ${r.currency}  ${String(chg).padStart(6)}%  ${r.exchange}  ${r.at}`,
  )
}
