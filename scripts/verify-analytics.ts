/**
 * Analiz sekmesinin rakamlarını DOĞRUDAN SQL ile karşılaştırır.
 *
 * analytics-calc.ts eski uygulamanın kodundan klonlanmadı, yeniden yazıldı ve
 * kur yöntemi bilerek değiştirildi. Bu yüzden kendi içinde tutarlı olması
 * yetmez — aynı sayıların bambaşka bir yoldan da çıkması gerekir. Buradaki
 * sorgular uygulamanın TypeScript'ine hiç dokunmadan aynı metrikleri üretir.
 *
 * Çalıştırmak için önce `npm run dev` (localhost:3000 gerekiyor):
 *   npx tsx scripts/verify-analytics.ts
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { computeAnalytics } from '../client/src/features/workspace/analytics-calc'

async function main() {
  const sql = neon(process.env.PORTFOLIO_DATABASE_URL!)
  const rate = (await (await fetch('http://localhost:3000/api/portfolio/summary')).json()).usdTryRate as number

  // ── BAĞIMSIZ YOL: doğrudan SQL, TypeScript koduna hiç dokunmadan ──────────
  const [v] = await sql`
    SELECT
      SUM(quantity * current_price * CASE WHEN type='us_stock' THEN ${rate}::numeric ELSE 1 END) AS value,
      SUM(quantity * buy_price     * CASE WHEN type='us_stock' THEN buy_rate ELSE 1 END) AS cost,
      SUM(quantity * (current_price - buy_price) * CASE WHEN type='us_stock' THEN ${rate}::numeric ELSE 1 END) AS shares,
      SUM(quantity * buy_price * (CASE WHEN type='us_stock' THEN ${rate}::numeric ELSE 1 END
                                - CASE WHEN type='us_stock' THEN buy_rate ELSE 1 END)) AS fx
    FROM positions`
  const [r] = await sql`
    SELECT SUM(pl * CASE WHEN type='us_stock' THEN ${rate}::numeric ELSE 1 END) AS realized,
           COUNT(*) FILTER (WHERE pl > 0) AS winners,
           COUNT(*) FILTER (WHERE pl < 0) AS losers,
           COUNT(*) AS total
    FROM closed_positions`

  // ── UYGULAMANIN YOLU ──────────────────────────────────────────────────────
  const s = await (await fetch('http://localhost:3000/api/portfolio/summary')).json()
  const c = await (await fetch('http://localhost:3000/api/portfolio/closed')).json()
  const a = computeAnalytics(s.positions, c, rate, { from: null, to: null })

  const f = (x: number) => x.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
  const cmp = (ad: string, sqlDeger: number, tsDeger: number) => {
    const fark = Math.abs(sqlDeger - tsDeger)
    const ok = fark < 1 // 1 TL'nin altı yuvarlama
    console.log(`  ${ok ? 'OK  ' : 'HATA'}  ${ad.padEnd(22)} SQL ${f(sqlDeger).padStart(12)}   uygulama ${f(tsDeger).padStart(12)}   fark ${fark.toFixed(4)}`)
    return ok
  }

  console.log(`  USD/TRY ${rate}\n`)
  let ok = true
  ok = cmp('Toplam değer', Number(v.value), a.totalValue) && ok
  ok = cmp('Toplam maliyet', Number(v.cost), a.totalCost) && ok
  ok = cmp('Gerçekleşmemiş K/Z', Number(v.value) - Number(v.cost), a.unrealized) && ok
  ok = cmp('↳ hisse hareketi', Number(v.shares), a.fromShares) && ok
  ok = cmp('↳ kur etkisi', Number(v.fx), a.fromCurrency) && ok
  ok = cmp('Gerçekleşen K/Z', Number(r.realized), a.realizedLifetime) && ok
  ok = cmp('Net K/Z', Number(r.realized) + Number(v.value) - Number(v.cost), a.net) && ok

  const sayilar = [
    ['Kazanan işlem', Number(r.winners), a.winners],
    ['Kaybeden işlem', Number(r.losers), a.losers],
    ['Kapatılan toplam', Number(r.total), a.closedCountLifetime],
  ] as const
  for (const [ad, q, t] of sayilar) {
    const pass = q === t
    ok = pass && ok
    console.log(`  ${pass ? 'OK  ' : 'HATA'}  ${ad.padEnd(22)} SQL ${String(q).padStart(12)}   uygulama ${String(t).padStart(12)}`)
  }
  console.log(ok ? '\n  BAĞIMSIZ SQL DOĞRULAMASI GEÇTİ' : '\n  UYUŞMAZLIK VAR')
  process.exit(ok ? 0 : 1)
}
main()
