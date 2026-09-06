/**
 * `portfolio_insight.actions` ile gerçek portföyün örtüştüğünü doğrular.
 *
 * Talimatnamedeki ADIM 5 iki şey söylüyor: aksiyon listesi HER açık pozisyonu
 * içerir ve YALNIZCA açık pozisyonları içerir. İkisi de hatırlanması gereken
 * kurallardı ve 6 Eylül 2026'da ikisi birden ihlal edildi (7 Eylül tarihli notu
 * yazarken) — 23 pozisyonun
 * 7'sine not yazıldı, listeye portföyde olmayan bir panel fikri (NVDA) girdi.
 * Kaybolan şey görünmüyordu da: NASA ve TXT için üç gündür bekleyen "SAT"
 * kararları listeden düştüğü an sessizce ortadan kalktı.
 *
 * Kural hatırlatmakla tutulmuyorsa ölçülmeli. İçeriği göndermeden önce çalıştır.
 *
 *   npx tsx scripts/verify-insight.ts
 *   npx tsx scripts/verify-insight.ts /path/to/payload.json   (göndermeden ÖNCE)
 *
 * Argümansız çağrılırsa panelde YAYINDA olan notu denetler.
 */

const BASE = 'https://equityresearch-production.up.railway.app'

interface Action {
  ticker: string
  action: string
  reason?: string
}

const VALID_ACTIONS = new Set(['BEKLE', 'KISMİ KÂR AL', 'SAT', 'POZİSYON ARTIR'])

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return (await res.json()) as T
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
    const live = await getJson<{ date: string; actions: Action[] }>('/api/portfolio/insight')
    actions = live.actions ?? []
    label = `yayındaki not: ${String(live.date).slice(0, 10)}`
  }

  const positions = await getJson<{ positions: { symbol: string }[] }>('/api/portfolio/summary')
  const held = new Set(positions.positions.map((p) => p.symbol))
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
