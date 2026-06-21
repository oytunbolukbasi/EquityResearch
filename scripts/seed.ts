/**
 * Idempotent seed script — safe to re-run at any time.
 * Each table uses delete-then-insert on the natural key so there are never
 * duplicate rows.
 *
 * Usage:  npx tsx scripts/seed.ts
 */
import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { db } from '../server/db/client'
import { morningNotes, ideas, tradePlans, heatmaps } from '../server/db/schema'

// ─── Morning Notes ───────────────────────────────────────────────────────────

const MORNING_NOTE = {
  date: '2026-06-19',
  topCall:
    "Figma'da Citi'nin agresif 'al' notu ve DRAM temasındaki güçlü ama gerilmiş momentum, bu haftanın iki ana başlığı.",
  macroBullets: [
    {
      label: 'FIG',
      detail:
        "Citi 'al' notuyla kapsama başladı, hedef 36$ — mevcut fiyatın iki katı. Hisse yıl başından beri yaklaşık %50 geriledi, Findell Capital aktivist baskısını sürdürüyor.",
    },
    {
      label: 'DRAM',
      detail:
        "Nisan'daki halka arzından bu yana üç katına yakın yükseldi, son kapanış 76,71$ — Kore (Samsung, SK Hynix) ve Micron ağırlıklı bellek çip arz açığı temasını taşıyor.",
    },
    {
      label: 'ABD Sektörleri',
      detail:
        'Cuma günü teknoloji (+%0,94) ve kamu hizmetleri (+%1,26) öne çıktı, sanayi (-%1,44) ve finans (-%1,14) zayıf kaldı.',
    },
    {
      label: 'BIST',
      detail:
        "Piyasa genişliği negatif: 1043 hissenin 623'ü düşüşte, breadth skoru 37/100.",
    },
  ],
  sectorDeepDive: {
    title: 'Yapay Zeka Donanım Teması',
    body: "Yapay zeka teması yazılımdan donanıma kayıyor; bellek çipi arzındaki kısıtlar bu geçişin en somut yansımalarından biri. Kore'nin bu pazardaki neredeyse tekel konumu DRAM ETF'inin sert yükselişini besliyor, ancak üç ayda üç katına yakın bir hareketten sonra kısa vadede risk de yükseldi.",
  },
}

// ─── Ideas ───────────────────────────────────────────────────────────────────

const IDEAS = [
  {
    date: '2026-06-19', ticker: 'FIG', exchange: 'NYSE', direction: 'long',
    thesis: "Citi 36$ hedefle 'al' notu başlattı; piyasa hâlâ ikna olmadı ama yapay zeka tasarımı bitirmiyor, Figma'yı yeni iş akışlarının merkezine taşıyor. Findell Capital'in aktivist baskısı ek katalizör.",
    entryLow: 17.50, entryHigh: 19.00, stopLoss: 16.50, target1: 21, target2: 25, status: 'active',
  },
  {
    date: '2026-06-19', ticker: 'DRAM', exchange: 'NYSE', direction: 'long',
    thesis: 'Yapay zeka bellek çipi arz açığı gerçek; Kore ve Micron neredeyse tekel konumda. Ancak ETF üç ayda üç katına yakın yükseldi, kısa vadede aşırı ısınmış.',
    entryLow: 73, entryHigh: 75, stopLoss: 69, target1: 82, target2: 90, status: 'active',
  },
  {
    date: '2026-06-19', ticker: 'ENKAI', exchange: 'BIST', direction: 'long',
    thesis: 'Orta Doğu yeniden imar teması, net nakit bilanço.',
    entryLow: 90, entryHigh: 94, stopLoss: 86, target1: 105, target2: 118, status: 'active',
  },
  {
    date: '2026-06-19', ticker: 'THYAO', exchange: 'BIST', direction: 'long',
    thesis: 'Petrol maliyet rahatlaması, agresif iskontolu değerleme.',
    entryLow: 318, entryHigh: 328, stopLoss: 298, target1: 360, target2: 390, status: 'active',
  },
  {
    date: '2026-06-18', ticker: 'MA', exchange: 'NYSE', direction: 'long',
    thesis: 'NTM F/K ~24,2x tarihsel ortalamanın altında; FOMC sonrası geri çekilmede kademeli ekleme fırsatı.',
    entryLow: 485, entryHigh: 500, stopLoss: 455, target1: 540, target2: 580, status: 'active',
  },
  {
    date: '2026-06-17', ticker: 'ISRG', exchange: 'NASDAQ', direction: 'long',
    thesis: "Robotik cerrahi lideri; FTC/İran/FOMC gürültüsünden bağımsız saf fundamentals hikayesi, 44 analistin medyan hedefi 615,50$.",
    entryLow: 440, entryHigh: 460, stopLoss: 410, target1: 510, target2: 565, status: 'active',
  },
]

// ─── Trade Plans ─────────────────────────────────────────────────────────────

const TRADE_PLANS = [
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
    ticker: 'DRAM', exchange: 'NYSE', currentPrice: 76.71,
    entryLow: 73, entryHigh: 75, tp1: 82, tp2: 90, tp3: 100, hardSl: 69,
    thesis: 'Kore ve Micron ağırlıklı bellek çip arz açığı teması; üç ayda üç katına yakın yükseliş kısa vadede aşırı ısınmış görünüyor.',
    invalidation: '69$ altı kapanış kısa vadeli momentumun kırıldığını gösterir.',
    priceHistory: [
      { t: '2026-06-19', o: 76.71, h: 77.09, l: 76.33, c: 76.71 },
    ],
  },
  {
    ticker: 'ENKAI', exchange: 'BIST', currentPrice: 94.4,
    entryLow: 90, entryHigh: 94, tp1: 105, tp2: 118, tp3: null, hardSl: 86,
    thesis: 'Orta Doğu yeniden imar teması, net nakit bilanço.',
    invalidation: '86 TL altı kapanış net nakit tezini zayıflatır.',
    priceHistory: [
      { t: '2026-06-01', o: 100.5, h: 101.8, l: 97.65, c: 98.5 },
      { t: '2026-06-02', o: 98.5,  h: 99.75, l: 98.5,  c: 99.2 },
      { t: '2026-06-03', o: 99.2,  h: 99.2,  l: 95.5,  c: 95.9 },
      { t: '2026-06-04', o: 96.2,  h: 97.25, l: 93.75, c: 94.95 },
      { t: '2026-06-05', o: 95.15, h: 95.15, l: 92.5,  c: 93.35 },
      { t: '2026-06-08', o: 93,    h: 95.55, l: 91.55, c: 94.95 },
      { t: '2026-06-09', o: 95.1,  h: 97.8,  l: 95.1,  c: 96.15 },
      { t: '2026-06-10', o: 96,    h: 96.2,  l: 92.8,  c: 93.8 },
      { t: '2026-06-11', o: 93.85, h: 94.3,  l: 90.95, c: 92.8 },
      { t: '2026-06-12', o: 94.4,  h: 95.3,  l: 92.75, c: 93 },
      { t: '2026-06-15', o: 95.5,  h: 96.7,  l: 94.3,  c: 96.1 },
      { t: '2026-06-16', o: 96.15, h: 96.5,  l: 93.45, c: 94.15 },
      { t: '2026-06-17', o: 94.4,  h: 94.7,  l: 92.45, c: 92.65 },
      { t: '2026-06-18', o: 93,    h: 94.65, l: 92.4,  c: 94.3 },
      { t: '2026-06-19', o: 93.4,  h: 94.7,  l: 92.9,  c: 94.4 },
    ],
  },
  {
    ticker: 'THYAO', exchange: 'BIST', currentPrice: 326.75,
    entryLow: 318, entryHigh: 328, tp1: 360, tp2: 390, tp3: null, hardSl: 298,
    thesis: 'Petrol maliyet rahatlaması, agresif iskontolu değerleme.',
    invalidation: '298 TL altı kapanış petrol maliyet tezini geçersiz kılar.',
    priceHistory: [
      { t: '2026-06-05', o: 299.75, h: 300.25, l: 295.25, c: 297 },
      { t: '2026-06-08', o: 293.5,  h: 299.5,  l: 292.5,  c: 297.25 },
      { t: '2026-06-09', o: 298.5,  h: 300,    l: 295.5,  c: 296.75 },
      { t: '2026-06-10', o: 296,    h: 298.25, l: 293.25, c: 295.5 },
      { t: '2026-06-11', o: 296,    h: 297.5,  l: 291.5,  c: 293.25 },
      { t: '2026-06-12', o: 301,    h: 311,    l: 301,    c: 307.75 },
      { t: '2026-06-15', o: 329,    h: 329.5,  l: 323.25, c: 325.75 },
      { t: '2026-06-16', o: 325,    h: 329,    l: 322.75, c: 326.5 },
      { t: '2026-06-17', o: 327.5,  h: 328.25, l: 321,    c: 321.75 },
      { t: '2026-06-18', o: 324,    h: 330,    l: 323.75, c: 328.5 },
      { t: '2026-06-19', o: 324,    h: 333.25, l: 323.75, c: 326.75 },
    ],
  },
  {
    ticker: 'MA', exchange: 'NYSE', currentPrice: 492.99,
    entryLow: 485, entryHigh: 500, tp1: 540, tp2: 580, tp3: 625, hardSl: 455,
    thesis: 'NTM F/K ~24,2x tarihsel ortalamanın altında, kademeli ekleme fırsatı.',
    invalidation: '455$ altı kapanış değerleme tezini bozar.',
    priceHistory: [
      { t: '2026-06-18', o: 492.99, h: 495.45, l: 490.53, c: 492.99 },
    ],
  },
  {
    ticker: 'ISRG', exchange: 'NASDAQ', currentPrice: 452,
    entryLow: 440, entryHigh: 460, tp1: 510, tp2: 565, tp3: 615, hardSl: 410,
    thesis: 'Robotik cerrahi lideri, saf fundamentals hikayesi, medyan hedef 615,50$.',
    invalidation: '410$ altı kapanış büyüme tezini zayıflatır.',
    priceHistory: [
      { t: '2026-06-17', o: 452, h: 454.26, l: 449.74, c: 452 },
    ],
  },
]

// ─── Heatmaps ────────────────────────────────────────────────────────────────

const HEATMAPS = [
  {
    date: '2026-06-19', market: 'US',
    sectors: [
      { name: 'Technology',            change_pct:  0.94, note: 'Çip ve AI donanım ralisi taşıyor' },
      { name: 'Utilities',             change_pct:  1.26, note: 'Faiz patikası karışıklığında savunmacı talep' },
      { name: 'Consumer Cyclical',     change_pct:  0.88, note: null },
      { name: 'Communication Services',change_pct:  0.61, note: null },
      { name: 'Energy',                change_pct: -0.79, note: null },
      { name: 'Consumer Defensive',    change_pct: -0.96, note: null },
      { name: 'Healthcare',            change_pct: -0.94, note: null },
      { name: 'Real Estate',           change_pct: -1.00, note: 'Şahin Fed faiz baskısı' },
      { name: 'Basic Materials',       change_pct: -1.09, note: null },
      { name: 'Financial Services',    change_pct: -1.14, note: null },
      { name: 'Industrials',           change_pct: -1.44, note: null },
    ],
  },
  {
    date: '2026-06-19', market: 'BIST',
    sectors: [
      { name: 'Bankacılık (XBANK)',  change_pct:  0.31, note: null },
      { name: 'Sınai (XUSIN)',       change_pct: -0.65, note: null },
      { name: 'Mali (XUMAL)',        change_pct:  0.01, note: null },
      { name: 'Hizmetler (XUHIZ)',   change_pct: -0.72, note: null },
      { name: 'Teknoloji (XUTEK)',   change_pct: -1.14, note: null },
      { name: 'Holding (XHOLD)',     change_pct: -1.80, note: 'Şahin Fed faiz baskısı' },
      { name: 'Kimya (XKMYA)',       change_pct: -0.28, note: null },
      { name: 'Gıda (XGIDA)',        change_pct: -0.84, note: null },
      { name: 'GYO (XGMYO)',         change_pct:  0.91, note: null },
      { name: 'İletişim (XILTM)',    change_pct: -2.07, note: 'Sadece 2 hisse (TCELL, TTKOM)' },
    ],
  },
]

// ─── Seed runner ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('Seeding database...\n')

  // 1. Morning notes — upsert by date
  await db.delete(morningNotes).where(eq(morningNotes.date, MORNING_NOTE.date))
  await db.insert(morningNotes).values({
    date:           MORNING_NOTE.date,
    topCall:        MORNING_NOTE.topCall,
    macroBullets:   MORNING_NOTE.macroBullets,
    sectorDeepDive: MORNING_NOTE.sectorDeepDive,
  })
  const mnCount = await db.$count(morningNotes)
  console.log(`morning_notes : ${mnCount} satır`)

  // 2. Ideas — upsert by (date, ticker)
  for (const idea of IDEAS) {
    await db.delete(ideas).where(
      and(eq(ideas.date, idea.date), eq(ideas.ticker, idea.ticker))
    )
  }
  await db.insert(ideas).values(
    IDEAS.map(d => ({
      date:        d.date,
      ticker:      d.ticker,
      exchange:    d.exchange ?? null,
      direction:   d.direction ?? null,
      thesis:      d.thesis ?? null,
      entryLow:    d.entryLow ?? null,
      entryHigh:   d.entryHigh ?? null,
      stopLoss:    d.stopLoss ?? null,
      target1:     d.target1 ?? null,
      target2:     d.target2 ?? null,
      status:      d.status ?? 'active',
    }))
  )
  const ideaCount = await db.$count(ideas)
  console.log(`ideas         : ${ideaCount} satır`)

  // 3. Trade plans — upsert by ticker
  for (const plan of TRADE_PLANS) {
    await db.delete(tradePlans).where(eq(tradePlans.ticker, plan.ticker))
  }
  await db.insert(tradePlans).values(
    TRADE_PLANS.map(d => ({
      ticker:       d.ticker,
      exchange:     d.exchange ?? null,
      currentPrice: d.currentPrice ?? null,
      entryLow:     d.entryLow ?? null,
      entryHigh:    d.entryHigh ?? null,
      tp1:          d.tp1 ?? null,
      tp2:          d.tp2 ?? null,
      tp3:          d.tp3 ?? null,
      hardSl:       d.hardSl ?? null,
      thesis:       d.thesis ?? null,
      invalidation: d.invalidation ?? null,
      priceHistory: d.priceHistory ?? null,
    }))
  )
  const tpCount = await db.$count(tradePlans)
  console.log(`trade_plans   : ${tpCount} satır`)

  // 4. Heatmaps — delete all for (market, date), then insert
  for (const hm of HEATMAPS) {
    await db.delete(heatmaps).where(
      and(eq(heatmaps.market, hm.market), eq(heatmaps.date, hm.date))
    )
  }
  await db.insert(heatmaps).values(
    HEATMAPS.map(d => ({
      date:    d.date,
      market:  d.market,
      sectors: d.sectors,
    }))
  )
  const hmCount = await db.$count(heatmaps)
  console.log(`heatmaps      : ${hmCount} satır`)

  console.log('\nSeed tamamlandı.')
}

seed().catch(err => {
  console.error('Seed hatası:', err)
  process.exit(1)
})
