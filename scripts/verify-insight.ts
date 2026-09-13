/**
 * `portfolio_insight.actions` ile gerçek portföyün örtüştüğünü doğrular.
 *
 * Talimatnamedeki ADIM 5 iki şey söylüyor: aksiyon listesi HER açık pozisyonu
 * içerir ve YALNIZCA açık pozisyonları içerir. İkisi de hatırlanması gereken
 * kurallardı ve 6 Eylül 2026'da, 7 Eylül tarihli not yazılırken ikisi birden
 * ihlal edildi: 23 pozisyonun 7'sine not yazıldı ve listeye portföyde olmayan
 * bir panel fikri (NVDA) girdi.
 * Kaybolan şey görünmüyordu da: NASA ve TXT için üç gündür bekleyen "SAT"
 * kararları listeden düştüğü an sessizce ortadan kalktı.
 *
 * Kural hatırlatmakla tutulmuyorsa ölçülmeli. İçeriği göndermeden önce çalıştır.
 *
 *   npx tsx scripts/verify-insight.ts
 *   npx tsx scripts/verify-insight.ts /path/to/payload.json   (göndermeden ÖNCE)
 *
 * Argümansız çağrılırsa panelde YAYINDA olan notu denetler.
 *
 * Veriyi HTTP'den değil DOĞRUDAN veritabanından okur. Eskiden
 * /api/portfolio/summary çağırıyordu; GÖREV 45 `/api` altındaki her şeyi oturum
 * arkasına aldı ve betik o günden beri 401 alıyordu — yani göndermeden önce
 * çalıştırılması gereken tek kontrol sessizce çalışmaz hale gelmişti. Betiğin
 * zaten `.env`'e erişimi var; aradaki HTTP katmanı hiçbir şey kazandırmıyordu.
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

interface Action {
  ticker: string
  action: string
  reason?: string
}

const VALID_ACTIONS = new Set(['BEKLE', 'KISMİ KÂR AL', 'SAT', 'POZİSYON ARTIR'])

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} tanımlı değil (.env okunamadı mı?)`)
  return v
}

async function main() {
  const file = process.argv[2]

  let actions: Action[]
  let label: string
  if (file) {
    const { readFile } = await import('node:fs/promises')
    const payload = JSON.parse(await readFile(file, 'utf8'))
    actions = payload?.portfolio_insight?.actions ?? []
    label = `dosya: ${file}`
  } else {
    const db = neon(requireEnv('DATABASE_URL'))
    const rows = (await db`
      select date, actions from portfolio_insights order by date desc limit 1
    `) as { date: string; actions: Action[] | null }[]
    if (!rows.length) throw new Error('portfolio_insights boş')
    actions = rows[0].actions ?? []
    label = `yayındaki not: ${String(rows[0].date).slice(0, 10)}`
  }

  const pf = neon(requireEnv('PORTFOLIO_DATABASE_URL'))
  const open = (await pf`
    select symbol from positions where user_id = 'demo-user'
  `) as { symbol: string }[]
  const held = new Set(open.map((p) => p.symbol))
  const noted = new Set(actions.map((a) => a.ticker))

  const missing = [...held].filter((s) => !noted.has(s)).sort()
  const extra = [...noted].filter((s) => !held.has(s)).sort()
  // Aynı sembole iki kez not yazmak sessizce birini gizler.
  const seen = new Set<string>()
  const duplicate = actions.map((a) => a.ticker).filter((t) => !seen.add(t))
  const badAction = actions.filter((a) => !VALID_ACTIONS.has(a.action))
  const emptyReason = actions.filter((a) => !a.reason?.trim())

  console.log(`${label} — ${actions.length} aksiyon / ${held.size} açık pozisyon\n`)

  const problems: string[] = []
  if (missing.length) problems.push(`Portföyde olup notu OLMAYAN (${missing.length}): ${missing.join(' ')}`)
  if (extra.length) problems.push(`Notu olup portföyde OLMAYAN (${extra.length}): ${extra.join(' ')}`)
  if (duplicate.length) problems.push(`Birden fazla kez yazılmış: ${[...new Set(duplicate)].join(' ')}`)
  if (badAction.length)
    problems.push(`Geçersiz aksiyon: ${badAction.map((a) => `${a.ticker}="${a.action}"`).join(' ')}`)
  if (emptyReason.length) problems.push(`Gerekçesi boş: ${emptyReason.map((a) => a.ticker).join(' ')}`)

  if (problems.length === 0) {
    console.log('✅ Aksiyon listesi portföyle birebir eşit; tüm gerekçeler dolu.')
    return
  }
  for (const p of problems) console.error(`❌ ${p}`)
  process.exitCode = 1
}

main().catch((e) => {
  console.error('Doğrulama çalıştırılamadı:', e)
  process.exitCode = 1
})
