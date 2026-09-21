/**
 * Risk / getiri, as two lengths.
 *
 * The bar runs from the stop (left) to TP1 (right) and is cut at the entry:
 * the red part is the distance from entry down to the stop (risk), the green
 * part the distance from entry up to TP1 (reward). The ratio is therefore not
 * a label to read — it is the green part being 2,3 times the red one.
 *
 * It replaced a red→green gradient with the entry band laid over it as a
 * translucent dark smear. That read as "a dark red dot" and said nothing: the
 * gradient blended the two distances into one colour ramp, and the one thing
 * that separates them — the entry — was the least legible mark on it.
 *
 * The ring is the sheet's delayed price (GET /api/trade-plans/live-prices):
 * in the red part the price is below entry and closer to the stop, near the
 * right end it is closing on TP1. Outside the range it sits pinned to the edge
 * it has passed.
 *
 * Deliberately no level labels — SL, Giriş and TP1 are the three columns to
 * its left. Width is capped at the column's own (the header sets it at ~100px),
 * so the drawing costs no horizontal space.
 */
interface RiskRewardBarProps {
  stopLoss: number
  entryLow: number
  entryHigh: number
  target1: number
  /** The delayed live price; omitted when the sheet doesn't track the ticker. */
  currentPrice?: number | null
  direction: 'long' | 'short' | string | null
  className?: string
}

/*
 * The panel's own red and green, a quarter of the way into the card. At full
 * strength (--down/--up, the colours of profit and loss text) an 8px solid bar
 * read as harsh, and it shouted as loudly as the two marks on top of it that
 * actually carry the reading — the entry line and the price ring. Measured:
 * 75% keeps the segments above the 3:1 graphics threshold on both themes
 * (light 3,55 / 3,28 · dark 3,48 / 4,04); 65% drops under it.
 * The marks stay at full strength, so the eye lands on them first.
 */
const RISK = 'color-mix(in srgb, var(--down) 75%, var(--card))'
const REWARD = 'color-mix(in srgb, var(--up) 75%, var(--card))'

const fmt1 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmt2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The geometry both sizes draw from: where entry and the price sit, and the ratio. */
function measure({ stopLoss, entryLow, entryHigh, target1, currentPrice, direction }: RiskRewardBarProps) {
  // Position as progress from the stop toward TP1 — works for longs and shorts
  // alike (for a short both run downward), so red is always the risk side.
  const pos = (v: number) => (v - stopLoss) / (target1 - stopLoss)
  const clamp = (x: number) => Math.max(0, Math.min(1, x))

  const isShort = direction === 'short'
  const entryMid = (entryLow + entryHigh) / 2
  const risk = isShort ? stopLoss - entryMid : entryMid - stopLoss
  const reward = isShort ? entryMid - target1 : target1 - entryMid
  const rr = risk > 0 && reward > 0 ? reward / risk : null

  const title = [
    `Risk (girişten stopa): ${fmt2(Math.abs(risk))}`,
    `Getiri (girişten TP1'e): ${fmt2(Math.abs(reward))}`,
    rr != null && `Getiri riskin ${fmt1(rr)} katı`,
    currentPrice != null && `Son fiyat: ${fmt2(currentPrice)}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    rr,
    title,
    entryAt: clamp(pos(entryMid)) * 100,
    nowAt: currentPrice != null ? clamp(pos(currentPrice)) * 100 : null,
  }
}

/** The bar itself: red and green parts, the entry tick, the price ring. */
function Track({ entryAt, nowAt, wide = false }: { entryAt: number; nowAt: number | null; wide?: boolean }) {
  // The wide track is 2px taller and its marks scale with it, so the tick and
  // ring keep the same overhang they have in the table.
  const bar = wide ? 'h-2.5' : 'h-2'
  const tick = wide ? '-top-[3px] h-4 w-[2px]' : '-top-[3px] h-3.5 w-[2px]'
  const ring = wide ? 16 : 14
  return (
    <div className={`relative ${bar} w-full`}>
      {/* risk */}
      <div
        className="absolute inset-y-0 left-0 rounded-l-full"
        style={{ width: `${entryAt}%`, background: RISK }}
      />
      {/* getiri */}
      <div
        className="absolute inset-y-0 right-0 rounded-r-full"
        style={{ left: `${entryAt}%`, background: REWARD }}
      />
      {/* giriş */}
      <div
        className={`absolute ${tick} rounded-full`}
        style={{ left: `calc(${entryAt}% - 1px)`, background: 'var(--ink)' }}
      />
      {/* son fiyat */}
      {nowAt != null && (
        <div
          className="absolute rounded-full border-[3px]"
          style={{
            width: ring,
            height: ring,
            top: '50%',
            marginTop: -ring / 2,
            left: `calc(${nowAt}% - ${ring / 2}px)`,
            background: 'var(--card)',
            borderColor: 'var(--info)',
          }}
        />
      )}
    </div>
  )
}

export function RiskRewardBar({ className = '', ...props }: RiskRewardBarProps) {
  if (props.stopLoss === props.target1) return null
  const { rr, title, entryAt, nowAt } = measure(props)

  return (
    <div className={`flex w-20 shrink-0 flex-col items-stretch gap-1.5 ${className}`} title={title}>
      {rr != null && (
        <span className="num text-ink text-center text-[12px] leading-none font-semibold">
          {fmt1(rr)}×
        </span>
      )}
      <Track entryAt={entryAt} nowAt={nowAt} />
    </div>
  )
}

/**
 * The same drawing at full width, for the top of the phone plan sheet: the
 * one-glance answer before the ladder below gives the detail. Only the two
 * ends are named — every price is already in the ladder under it, and naming
 * them here would say each one twice.
 */
export function RiskRewardStrip({ className = '', ...props }: RiskRewardBarProps) {
  if (props.stopLoss === props.target1) return null
  const { rr, title, entryAt, nowAt } = measure(props)

  return (
    <div className={className} title={title}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-mid text-[12px]">Risk / getiri</span>
        {rr != null && (
          <span className="text-mid text-[12px]">
            getiri riskin{' '}
            <span className="num text-ink text-[15px] font-semibold">{fmt1(rr)}×</span>
          </span>
        )}
      </div>
      <Track entryAt={entryAt} nowAt={nowAt} wide />
      <div className="text-mid mt-2 flex justify-between text-[12px]">
        <span>Stop</span>
        <span>TP1</span>
      </div>
    </div>
  )
}
