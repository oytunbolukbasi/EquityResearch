/**
 * Borsa İstanbul piyasa genişliği — yükselen / düşen / sabit hisse sayısı.
 *
 *   node scripts/bist-breadth.mjs                  son seans
 *   node scripts/bist-breadth.mjs --date 2026-09-22
 *   node scripts/bist-breadth.mjs --json
 *
 * İzleme listesindeki Borsa İstanbul koşulu ("yükselenlerin oranı 0,40'ı geçsin")
 * bu sayıya dayanıyor. Eskiden Matriks AI bağlayıcısından geliyordu; o bağlayıcı
 * kullanılmıyor (talimatname, "VERİ KAYNAKLARI"). Bu betik aynı ölçüyü anahtarsız
 * iki kaynaktan kuruyor:
 *
 * - Evren: Twelve Data'nın açık sembol listesi (`/stocks?exchange=BIST`, anahtar
 *   istemiyor) — ~620 adi hisse, eski ölçünün evreni olan BIST Tüm'e (629) yakın.
 *   Eşik o ölçekte konduğu için BIST 100 değil tüm pazar sayılıyor. Liste
 *   alınamazsa son başarılı liste `scripts/data/bist-universe.json`'dan okunur.
 * - Fiyat: Yahoo chart ucu (yfinance'in de kaynağı), hisse başına bir istek.
 *
 * Oran = yükselen / (yükselen + düşen + sabit). Eskisiyle aynı tanım.
 *
 * Sabah tuzağı: tur 05:00'te yapılıyor ve o saatte dünkü BİST günlük barı
 * Yahoo'da çoğu zaman henüz boş. O durumda dünkü kapanış `meta.regularMarketPrice`'tan
 * (son işlem fiyatı) alınır, karşılaştırma bir önceki TAM barla yapılır. Önceki
 * seansın barı da yoksa hisse sayılmaz, "veri yok" olarak raporlanır — tahmini
 * bir sayı oranı sessizce bozar.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : null

// fileURLToPath, not `.pathname`: the repo path has a space and the URL form
// keeps it as %20 — the cache landed in a sibling folder named `Equity%20Research`.
const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'bist-universe.json')
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart'
const CONCURRENCY = 8

async function universe() {
  try {
    const res = await fetch('https://api.twelvedata.com/stocks?exchange=BIST&type=Common%20Stock', {
      signal: AbortSignal.timeout(20000),
    })
    const body = await res.json()
    const symbols = (body.data ?? []).map((s) => s.symbol).filter(Boolean)
    if (symbols.length < 400) throw new Error(`liste kısa geldi (${symbols.length})`)
    // Written only when the list itself changes. Rewriting on every run changed
    // nothing but the timestamp and left the file permanently modified in git.
    let cached = null
    try {
      cached = JSON.parse(fs.readFileSync(CACHE, 'utf8')).symbols
    } catch {}
    const same = cached && cached.length === symbols.length && cached.every((s, i) => s === symbols[i])
    if (!same) {
      fs.mkdirSync(path.dirname(CACHE), { recursive: true })
      fs.writeFileSync(CACHE, JSON.stringify({ at: new Date().toISOString(), symbols }, null, 1))
    }
    return { symbols, source: same ? 'twelvedata' : 'twelvedata (liste değişti, önbellek yenilendi)' }
  } catch (e) {
    const cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
    return { symbols: cached.symbols, source: `önbellek (${cached.at.slice(0, 10)}) — ${e.message}` }
  }
}

/** Istanbul takvim günü (UTC+3, yaz saati yok). */
const trDay = (unix) => new Date((unix + 3 * 3600) * 1000).toISOString().slice(0, 10)

async function fetchOne(symbol, attempt = 1) {
  const range = dateArg ? '1mo' : '5d'
  const res = await fetch(`${YAHOO}/${encodeURIComponent(symbol + '.IS')}?range=${range}&interval=1d`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 2000 * attempt))
    return fetchOne(symbol, attempt + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  if (!r?.timestamp) throw new Error('bar yok')
  const closes = r.indicators.quote[0].close
  const bars = r.timestamp.map((t, i) => ({ day: trDay(t), c: closes[i] })).filter((b) => b.c != null)

  if (dateArg) {
    const i = bars.findIndex((b) => b.day === dateArg)
    if (i < 1) return null
    return { day: dateArg, c: bars[i].c, prev: bars[i - 1].c }
  }

  // Son seans: işlem zamanından. Barı boşsa kapanışı son işlem fiyatı verir.
  const lastDay = trDay(r.meta.regularMarketTime)
  const last = bars.at(-1)
  if (last?.day === lastDay) {
    if (bars.length < 2) return null
    return { day: lastDay, c: last.c, prev: bars.at(-2).c }
  }
  if (typeof r.meta.regularMarketPrice !== 'number' || !last) return null
  return { day: lastDay, c: r.meta.regularMarketPrice, prev: last.c, fromMeta: true }
}

const { symbols, source } = await universe()
const results = []
let next = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < symbols.length) {
      const s = symbols[next++]
      try {
        results.push({ s, ...(await fetchOne(s)) })
      } catch {
        results.push({ s })
      }
    }
  }),
)

// Tek bir seans sayılır: hisselerin çoğunun son işlem günü. Uzun süredir işlem
// görmeyen (kapatılmış, askıdaki) bir hisse başka bir günü taşır ve dışarıda kalır.
const days = {}
for (const r of results) if (r.day) days[r.day] = (days[r.day] ?? 0) + 1
const session = dateArg ?? Object.entries(days).sort((a, b) => b[1] - a[1])[0]?.[0]

let up = 0, down = 0, flat = 0, missing = 0, fromMeta = 0
for (const r of results) {
  if (r.day !== session || r.c == null || r.prev == null) { missing++; continue }
  const d = Math.round(r.c * 100) - Math.round(r.prev * 100)
  if (d > 0) up++
  else if (d < 0) down++
  else flat++
  if (r.fromMeta) fromMeta++
}
const counted = up + down + flat
const ratio = counted ? up / counted : null

const out = { session, up, down, flat, counted, missing, ratio, fromMeta, universe: symbols.length, source }
if (asJson) console.log(JSON.stringify(out))
else {
  const pct = (x) => (x * 100).toFixed(1).replace('.', ',')
  console.log(`Seans ${session} · yükselen ${up} · düşen ${down} · sabit ${flat} → oran ${ratio?.toFixed(3).replace('.', ',')} (%${pct(ratio ?? 0)})`)
  console.log(`Sayılan ${counted}/${symbols.length} · veri yok ${missing}` + (fromMeta ? ` · ${fromMeta} hissenin kapanışı son işlem fiyatından (günlük bar henüz boş)` : ''))
  console.log(`Evren: ${source}`)
}
