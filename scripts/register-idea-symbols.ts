/**
 * Açık fikirlerin sembollerini fiyat e-tablosuna ekler.
 *
 *   npx tsx scripts/register-idea-symbols.ts           # eksikleri listeler, ekler
 *   npx tsx scripts/register-idea-symbols.ts --dry     # yalnız listeler
 *
 * Fikirler ekranı "Son fiyat"ı portföyle aynı e-tablodan (~15 dk gecikmeli
 * GOOGLEFINANCE) okur. E-tablo yalnız satırı olan sembolü bilir; portföyde
 * olmayan bir fikir (NVDA, SCHW…) orada yoksa ekran içerik turunun yazdığı
 * kapanışa düşer.
 *
 * Normalde bu işi `bulk-import` yapar — yeni bir fikir geldiğinde sembolü
 * arka planda kaydeder. Bu betik iki durum için: o mekanizmadan ÖNCE açılmış
 * fikirler, ve arka plandaki kayıt bir gün sessizce düşerse.
 *
 * Yalnız AÇIK fikirler (active / review). Kapanmış bir fikrin canlı fiyatı hiçbir
 * soruyu cevaplamıyor ve e-tablodaki her satır her okumada yeniden hesaplanıyor.
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

import { fetchSharePrices, registerSymbol } from '../server/services/price-source'
import { typeForExchange } from '../shared/asset-types'

const dry = process.argv.includes('--dry')

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL tanımlı değil')
const db = neon(url)

// Bir fikrin güncel statüsü, o ticker'ın EN SON kaydıdır (GÖREV 9).
const rows = (await db`
  select distinct on (ticker) ticker, exchange, status
  from ideas
  order by ticker, date desc, id desc
`) as { ticker: string; exchange: string | null; status: string }[]

const open = rows.filter((r) => r.status === 'active' || r.status === 'review')
const { prices } = await fetchSharePrices(true, { attempts: 2, timeoutMs: 60_000 })

const missing = open.filter((r) => prices[r.ticker.toUpperCase()] == null)
const unpriceable = missing.filter((r) => !typeForExchange(r.exchange))
const toRegister = missing.filter((r) => typeForExchange(r.exchange))

console.log(`Açık fikir: ${open.length} · e-tabloda: ${open.length - missing.length} · eksik: ${missing.length}`)
for (const r of unpriceable) console.log(`  ⚠ ${r.ticker} — borsa "${r.exchange}" e-tabloya eşlenemiyor, atlandı`)

if (!toRegister.length) {
  console.log('Eklenecek sembol yok.')
  process.exit(0)
}

for (const r of toRegister) {
  const type = typeForExchange(r.exchange)!
  if (dry) {
    console.log(`  (dry) ${r.ticker} → ${type}`)
    continue
  }
  await registerSymbol(r.ticker, type)
  console.log(`  + ${r.ticker} → ${type}`)
}

if (!dry) {
  console.log('\nE-tablo yeni satırları hesaplarken birkaç saniye geçebilir; doğrulama:')
  const after = await fetchSharePrices(true, { attempts: 2, timeoutMs: 60_000 })
  for (const r of toRegister) {
    const p = after.prices[r.ticker.toUpperCase()]
    console.log(`  ${r.ticker}: ${p != null ? p : 'henüz fiyat yok (sonraki okumada gelir)'}`)
  }
}
