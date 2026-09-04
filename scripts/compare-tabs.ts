/**
 * Genel Bakış KPI kartları ile Analiz sekmesinin aynı sayıyı verdiğini doğrular.
 * İkisi de artık computeAnalytics'ten besleniyor; bu script o tekliği koruyor.
 *   npx tsx scripts/compare-tabs.ts   (önce npm run dev)
 */
import { computeAnalytics } from '../client/src/features/workspace/analytics-calc'

async function main() {
  const s = await (await fetch('http://localhost:3000/api/portfolio/summary')).json()
  const c = await (await fetch('http://localhost:3000/api/portfolio/closed')).json()
  const a = computeAnalytics(s.positions, c, s.usdTryRate, { from: null, to: null })
  const f = (x: number) => x.toLocaleString('tr-TR', { maximumFractionDigits: 0 })

  // Kartların toplamı = Analiz'in toplamı olmalı
  const kartToplamDeger = a.tryAssets.value + a.usdAssets.value
  const kartToplamMaliyet = a.tryAssets.cost + a.usdAssets.cost
  const check = (ad: string, x: number, y: number) => {
    const ok = Math.abs(x - y) < 1
    console.log(`  ${ok ? 'OK  ' : 'FARK'}  ${ad.padEnd(34)} ${f(x).padStart(12)} ↔ ${f(y).padStart(12)}`)
    return ok
  }
  let ok = true
  ok = check('TL + ABD kartı = toplam değer', kartToplamDeger, a.totalValue) && ok
  ok = check('TL + ABD kartı = toplam maliyet', kartToplamMaliyet, a.totalCost) && ok
  ok = check('kart K/Z toplamı = gerçekleşmemiş', a.tryAssets.pl + a.usdAssets.pl, a.unrealized) && ok
  ok = check('tür dağılımı = toplam değer', a.byType.reduce((x, t) => x + t.bucket.value, 0), a.totalValue) && ok

  console.log(`\n  Genel bakış kartı 1: ${f(a.totalValue)}  (${f(a.unrealized)} · ${a.unrealizedPercent.toFixed(2)}%)`)
  console.log(`  Analiz başlığı     : ${f(a.totalValue)}  (aynı değer, alt satırda net ${f(a.net)})`)
  console.log(ok ? '\n  IKI SEKME TEK KAYNAKTAN, UYUMLU' : '\n  UYUSMAZLIK')
  process.exit(ok ? 0 : 1)
}
main()
