/**
 * One-off upsert: refreshes currentPrice + priceHistory for trade_plans rows,
 * keyed on ticker. Leaves entryLow/entryHigh/tp1/tp2/tp3/hardSl/thesis/
 * invalidation untouched on existing rows — only inserts those fields when a
 * ticker doesn't exist yet (insert needs a full row).
 *
 * Usage: npx tsx scripts/update-trade-plan-prices.ts
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../server/db/client'
import { tradePlans } from '../server/db/schema'

const PLANS = [
  {
    ticker: 'FIG', exchange: 'NYSE', currentPrice: 18.72,
    entryLow: 17.50, entryHigh: 19.00, tp1: 21, tp2: 25, tp3: 31, hardSl: 16.50,
    thesis: "Citi 36$ hedefle al notu başlattı, AI tasarımı bitirmiyor genişletiyor. Findell aktivist baskısı ek katalizör.",
    invalidation: '16,50$ altı günlük kapanış tezi geçersiz kılar.',
    priceHistory: [
      { t: '2026-06-05', o: 22.44, h: 22.66, l: 21.26, c: 21.75 },
      { t: '2026-06-08', o: 21.60, h: 21.94, l: 21.06, c: 21.10 },
      { t: '2026-06-09', o: 20.69, h: 21.13, l: 19.77, c: 20.49 },
      { t: '2026-06-10', o: 19.71, h: 20.63, l: 19.61, c: 19.79 },
      { t: '2026-06-11', o: 19.47, h: 19.73, l: 18.75, c: 19.34 },
      { t: '2026-06-12', o: 18.98, h: 19.13, l: 17.83, c: 18.54 },
      { t: '2026-06-15', o: 18.87, h: 19.40, l: 18.47, c: 18.51 },
      { t: '2026-06-16', o: 18.28, h: 18.50, l: 17.88, c: 17.98 },
      { t: '2026-06-17', o: 18.95, h: 19.86, l: 18.23, c: 18.65 },
      { t: '2026-06-18', o: 18.95, h: 19.18, l: 18.29, c: 18.72 },
    ],
  },
  {
    ticker: 'DRAM', exchange: 'NYSE', currentPrice: 78.15,
    entryLow: 73, entryHigh: 75, tp1: 82, tp2: 90, tp3: 100, hardSl: 69,
    thesis: 'Kore ve Micron ağırlıklı bellek çip arz açığı teması; üç ayda üç katına yakın yükseliş kısa vadede aşırı ısınmış görünüyor.',
    invalidation: '69$ altı kapanış kısa vadeli momentumun kırıldığını gösterir.',
    priceHistory: [
      { t: '2026-06-18', o: 75.25, h: 77.70, l: 75.02, c: 76.71 },
    ],
  },
  {
    ticker: 'ENKAI', exchange: 'BIST', currentPrice: 94.4,
    entryLow: 90, entryHigh: 94, tp1: 105, tp2: 118, tp3: null, hardSl: 86,
    thesis: 'Orta Doğu yeniden imar teması, net nakit bilanço.',
    invalidation: '86 TL altı kapanış net nakit tezini zayıflatır.',
    priceHistory: [
      { t: '2026-06-01', o: 100.5, h: 101.8, l: 97.65, c: 98.5 },
      { t: '2026-06-02', o: 98.5, h: 99.75, l: 98.5, c: 99.2 },
      { t: '2026-06-03', o: 99.2, h: 99.2, l: 95.5, c: 95.9 },
      { t: '2026-06-04', o: 96.2, h: 97.25, l: 93.75, c: 94.95 },
      { t: '2026-06-05', o: 95.15, h: 95.15, l: 92.5, c: 93.35 },
      { t: '2026-06-08', o: 93, h: 95.55, l: 91.55, c: 94.95 },
      { t: '2026-06-09', o: 95.1, h: 97.8, l: 95.1, c: 96.15 },
      { t: '2026-06-10', o: 96, h: 96.2, l: 92.8, c: 93.8 },
      { t: '2026-06-11', o: 93.85, h: 94.3, l: 90.95, c: 92.8 },
      { t: '2026-06-12', o: 94.4, h: 95.3, l: 92.75, c: 93 },
      { t: '2026-06-15', o: 95.5, h: 96.7, l: 94.3, c: 96.1 },
      { t: '2026-06-16', o: 96.15, h: 96.5, l: 93.45, c: 94.15 },
      { t: '2026-06-17', o: 94.4, h: 94.7, l: 92.45, c: 92.65 },
      { t: '2026-06-18', o: 93, h: 94.65, l: 92.4, c: 94.3 },
      { t: '2026-06-19', o: 93.4, h: 94.7, l: 92.9, c: 94.4 },
    ],
  },
  {
    ticker: 'THYAO', exchange: 'BIST', currentPrice: 326.75,
    entryLow: 318, entryHigh: 328, tp1: 360, tp2: 390, tp3: null, hardSl: 298,
    thesis: 'Petrol maliyet rahatlaması, agresif iskontolu değerleme.',
    invalidation: '298 TL altı kapanış petrol maliyet tezini geçersiz kılar.',
    priceHistory: [
      { t: '2026-06-05', o: 299.75, h: 300.25, l: 295.25, c: 297 },
      { t: '2026-06-08', o: 293.5, h: 299.5, l: 292.5, c: 297.25 },
      { t: '2026-06-09', o: 298.5, h: 300, l: 295.5, c: 296.75 },
      { t: '2026-06-10', o: 296, h: 298.25, l: 293.25, c: 295.5 },
      { t: '2026-06-11', o: 296, h: 297.5, l: 291.5, c: 293.25 },
      { t: '2026-06-12', o: 301, h: 311, l: 301, c: 307.75 },
      { t: '2026-06-15', o: 329, h: 329.5, l: 323.25, c: 325.75 },
      { t: '2026-06-16', o: 325, h: 329, l: 322.75, c: 326.5 },
      { t: '2026-06-17', o: 327.5, h: 328.25, l: 321, c: 321.75 },
      { t: '2026-06-18', o: 324, h: 330, l: 323.75, c: 328.5 },
      { t: '2026-06-19', o: 324, h: 333.25, l: 323.75, c: 326.75 },
    ],
  },
  {
    ticker: 'MA', exchange: 'NYSE', currentPrice: 489.27,
    entryLow: 485, entryHigh: 500, tp1: 540, tp2: 580, tp3: 625, hardSl: 455,
    thesis: 'NTM F/K ~24,2x tarihsel ortalamanın altında, kademeli ekleme fırsatı.',
    invalidation: '455$ altı kapanış değerleme tezini bozar.',
    priceHistory: [
      { t: '2026-06-01', o: 494.25, h: 497.13, l: 488.65, c: 495.25 },
      { t: '2026-06-02', o: 493.06, h: 493.99, l: 477.68, c: 477.68 },
      { t: '2026-06-03', o: 477.35, h: 481.96, l: 464.52, c: 471.55 },
      { t: '2026-06-04', o: 479.56, h: 488.55, l: 477.46, c: 481.76 },
      { t: '2026-06-05', o: 484.00, h: 494.00, l: 484.00, c: 491.08 },
      { t: '2026-06-08', o: 486.76, h: 489.52, l: 483.70, c: 485.67 },
      { t: '2026-06-09', o: 483.89, h: 495.42, l: 482.00, c: 495.24 },
      { t: '2026-06-10', o: 497.47, h: 498.80, l: 486.50, c: 489.08 },
      { t: '2026-06-11', o: 488.66, h: 491.47, l: 484.39, c: 486.51 },
      { t: '2026-06-12', o: 490.00, h: 490.00, l: 484.88, c: 489.27 },
    ],
  },
  {
    ticker: 'ISRG', exchange: 'NASDAQ', currentPrice: 406.78,
    entryLow: 440, entryHigh: 460, tp1: 510, tp2: 565, tp3: 615, hardSl: 410,
    thesis: 'Robotik cerrahi lideri, saf fundamentals hikayesi, medyan hedef 615,50$.',
    invalidation: "410$ altı kapanış büyüme tezini zayıflatır. NOT: 2 Haziran'dan beri zaten bu seviyenin altında, tez fiilen geçersiz.",
    priceHistory: [
      { t: '2026-06-04', o: 413.86, h: 423.50, l: 412.62, c: 418.82 },
      { t: '2026-06-05', o: 420.00, h: 428.46, l: 419.50, c: 422.06 },
      { t: '2026-06-08', o: 422.54, h: 424.39, l: 417.14, c: 418.61 },
      { t: '2026-06-09', o: 421.13, h: 430.85, l: 417.55, c: 426.61 },
      { t: '2026-06-10', o: 424.14, h: 426.20, l: 411.92, c: 412.02 },
      { t: '2026-06-11', o: 412.16, h: 416.19, l: 406.82, c: 412.90 },
      { t: '2026-06-12', o: 415.01, h: 415.76, l: 402.73, c: 411.06 },
      { t: '2026-06-15', o: 412.94, h: 420.59, l: 412.88, c: 416.55 },
      { t: '2026-06-16', o: 419.00, h: 422.46, l: 412.93, c: 417.07 },
      { t: '2026-06-17', o: 415.00, h: 418.24, l: 400.10, c: 402.18 },
      { t: '2026-06-18', o: 403.60, h: 409.64, l: 400.93, c: 406.78 },
    ],
  },
]

async function main() {
  for (const p of PLANS) {
    const existing = await db
      .select({ id: tradePlans.id })
      .from(tradePlans)
      .where(eq(tradePlans.ticker, p.ticker))
      .limit(1)

    if (existing.length) {
      await db
        .update(tradePlans)
        .set({ currentPrice: p.currentPrice, priceHistory: p.priceHistory, updatedAt: new Date() })
        .where(eq(tradePlans.ticker, p.ticker))
    } else {
      await db.insert(tradePlans).values({
        ticker: p.ticker,
        exchange: p.exchange,
        currentPrice: p.currentPrice,
        entryLow: p.entryLow,
        entryHigh: p.entryHigh,
        tp1: p.tp1,
        tp2: p.tp2,
        tp3: p.tp3,
        hardSl: p.hardSl,
        thesis: p.thesis,
        invalidation: p.invalidation,
        priceHistory: p.priceHistory,
      })
    }

    console.log(`${p.ticker.padEnd(6)}: ${p.priceHistory.length} priceHistory bar`)
  }

  console.log('Trade plan fiyat güncellemesi tamamlandı.')
}

main()
