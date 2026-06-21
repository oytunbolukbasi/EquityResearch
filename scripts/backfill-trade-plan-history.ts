/**
 * One-off OHLC backfill: applies scripts/ohlc-data.json (produced by
 * scripts/fetch_ohlc.py) to trade_plans.priceHistory + currentPrice.
 *
 * Never touches entryLow/entryHigh/tp1/tp2/tp3/hardSl/thesis/invalidation.
 *
 * Always prints a diff report (old vs new currentPrice, and whether any
 * level got crossed). Without --apply it ONLY reports — no DB write. Re-run
 * with --apply once the report has been reviewed.
 *
 * Usage:
 *   npx tsx scripts/backfill-trade-plan-history.ts            # dry run / report
 *   npx tsx scripts/backfill-trade-plan-history.ts --apply    # write to DB
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { eq } from 'drizzle-orm'
import { db } from '../server/db/client'
import { tradePlans } from '../server/db/schema'

interface OhlcRow { t: string; o: number; h: number; l: number; c: number }
interface FetchedTicker { yahooSymbol: string; currentPrice: number; priceHistory: OhlcRow[] }

const APPLY = process.argv.includes('--apply')
const __dirname = dirname(fileURLToPath(import.meta.url))

const data: Record<string, FetchedTicker> = JSON.parse(
  readFileSync(join(__dirname, 'ohlc-data.json'), 'utf-8'),
)

const PCT_THRESHOLD = 3

function pctDiff(oldV: number, newV: number): number {
  return ((newV - oldV) / oldV) * 100
}

// Was `level` on a different side of `oldPrice` vs `newPrice`?
function crossed(oldPrice: number, newPrice: number, level: number): boolean {
  return (oldPrice - level >= 0) !== (newPrice - level >= 0)
}

interface Flag { ticker: string; oldPrice: number; newPrice: number; note: string }

async function main() {
  const flags: Flag[] = []
  const rows: { ticker: string; oldPrice: number | null; newPrice: number; bars: number }[] = []

  for (const [ticker, fetched] of Object.entries(data)) {
    const existing = await db.select().from(tradePlans).where(eq(tradePlans.ticker, ticker)).limit(1)
    const plan = existing[0]
    const oldPrice = plan?.currentPrice ?? null
    const newPrice = fetched.currentPrice

    rows.push({ ticker, oldPrice, newPrice, bars: fetched.priceHistory.length })

    if (plan && oldPrice != null) {
      const diff = pctDiff(oldPrice, newPrice)
      if (Math.abs(diff) > PCT_THRESHOLD) {
        flags.push({
          ticker, oldPrice, newPrice,
          note: `currentPrice %${diff.toFixed(1)} değişti (eşik %${PCT_THRESHOLD})`,
        })
      }
      for (const [label, level] of [
        ['Hard SL', plan.hardSl],
        ['TP1', plan.tp1],
        ['TP2', plan.tp2],
        ['TP3', plan.tp3],
      ] as const) {
        if (level != null && crossed(oldPrice, newPrice, level)) {
          flags.push({ ticker, oldPrice, newPrice, note: `${label} (${level}) seviyesi geçildi` })
        }
      }
      if (plan.entryLow != null && plan.entryHigh != null) {
        const wasInBand = oldPrice >= plan.entryLow && oldPrice <= plan.entryHigh
        const nowInBand = newPrice >= plan.entryLow && newPrice <= plan.entryHigh
        if (wasInBand !== nowInBand) {
          flags.push({
            ticker, oldPrice, newPrice,
            note: `Giriş Bandı (${plan.entryLow}–${plan.entryHigh}) ${nowInBand ? 'içine girdi' : 'dışına çıktı'}`,
          })
        }
      }
    }
  }

  console.log('Çekilen veri özeti:')
  for (const r of rows) {
    console.log(
      `  ${r.ticker.padEnd(6)} eski=${r.oldPrice ?? '—'}  yeni=${r.newPrice}  bar=${r.bars}`,
    )
  }

  if (flags.length) {
    console.log('\n⚠ İncelenmesi gereken değişiklikler:')
    console.log('  Ticker | Eski Fiyat | Yeni Fiyat | Not')
    for (const f of flags) {
      console.log(`  ${f.ticker.padEnd(6)} | ${f.oldPrice} | ${f.newPrice} | ${f.note}`)
    }
  } else {
    console.log('\nEşik aşımı veya seviye geçişi yok.')
  }

  if (!APPLY) {
    console.log('\n(dry run — DB değiştirilmedi. Onaydan sonra --apply ile çalıştırın.)')
    return
  }

  for (const [ticker, fetched] of Object.entries(data)) {
    await db
      .update(tradePlans)
      .set({
        currentPrice: fetched.currentPrice,
        priceHistory: fetched.priceHistory,
        updatedAt: new Date(),
      })
      .where(eq(tradePlans.ticker, ticker))
  }
  console.log('\nDB güncellendi.')
}

main()
