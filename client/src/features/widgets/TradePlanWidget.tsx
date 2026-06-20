import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { OhlcPoint, TradePlan } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { fmtDataDate, useWidgetSubtitle } from '@/features/dashboard/widget-subtitle'

// ─── layout constants ────────────────────────────────────────────────────────
const VBW = 760
const CL = 20, CR = 616, CT = 16, CB = 375
const LABEL_X = CR + 8
const XAXIS_Y = CB + 20

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtP(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pctStr(price: number, current: number): string {
  const p = ((price - current) / current) * 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
}

function makePriceRange(plan: TradePlan) {
  const levels = [plan.tp3, plan.tp2, plan.tp1, plan.entryHigh, plan.entryLow, plan.currentPrice, plan.hardSl]
    .filter((p): p is number => typeof p === 'number')
  const hist = (plan.priceHistory ?? []).flatMap(c => [c.h, c.l])
  const all = [...levels, ...hist]
  if (!all.length) return { priceMin: 0, priceMax: 100 }
  const mn = Math.min(...all)
  const mx = Math.max(...all)
  const pad = (mx - mn) * 0.1 || 5
  return { priceMin: mn - pad, priceMax: mx + pad }
}

function makeCandleHelpers(candles: OhlcPoint[], priceMin: number, priceMax: number) {
  const N = candles.length
  const chartW = CR - CL
  const xStep = N > 0 ? chartW / N : chartW
  const cw = Math.min(xStep * 0.7, 12)
  const py = (p: number) => CT + (1 - (p - priceMin) / (priceMax - priceMin)) * (CB - CT)
  const cx = (i: number) => CL + xStep * (i + 0.5)
  return { N, xStep, cw, py, cx }
}

// ─── sub-components ───────────────────────────────────────────────────────────
function LegendChip({
  color,
  bg,
  children,
}: {
  color: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <span
      className="num inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: bg, color }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}

interface LevelRowProps {
  dotColor: string
  label: string
  price: string
  pct: string | null
  isUp: boolean
}
function LevelRow({ dotColor, label, price, pct, isUp }: LevelRowProps) {
  return (
    <div className="num flex items-center justify-between border-b border-faint2 py-2 text-xs last:border-0">
      <span className="flex items-center gap-2 text-mid">
        <span className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} />
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-medium text-ink">{price}</span>
        {pct && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={
              isUp
                ? { background: '#edf5f2', color: '#1a7a5e' }
                : { background: '#fdf0ee', color: '#c0392b' }
            }
          >
            {pct}
          </span>
        )}
      </span>
    </div>
  )
}

// ─── chart SVG ───────────────────────────────────────────────────────────────
function TradePlanChart({ plan }: { plan: TradePlan }) {
  const candles = plan.priceHistory ?? []
  const { priceMin, priceMax } = makePriceRange(plan)
  const { N, cw, py, cx } = makeCandleHelpers(candles, priceMin, priceMax)

  const gridPrices = Array.from(
    { length: 5 },
    (_, i) => priceMax - (i * (priceMax - priceMin)) / 4,
  )

  const monthLabels: { x: number; label: string }[] = []
  let lastMonth = -1
  candles.forEach((c, i) => {
    const m = new Date(c.t).getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ x: cx(i), label: MONTHS_TR[m] })
      lastMonth = m
    }
  })

  const entryY1 = plan.entryHigh != null ? py(plan.entryHigh) : null
  const entryY2 = plan.entryLow != null ? py(plan.entryLow) : null

  const markerX = N > 0 ? cx(N - 1) : CR
  const markerY = plan.currentPrice != null ? py(plan.currentPrice) : null

  const MONO = "'JetBrains Mono', monospace"

  return (
    <svg
      viewBox={`0 0 ${VBW} ${XAXIS_Y + 8}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* gray horizontal grid */}
      {gridPrices.map((gp, i) => (
        <g key={i}>
          <line x1={CL} y1={py(gp)} x2={CR} y2={py(gp)} stroke="#eeede9" strokeWidth="1" />
          <text
            x={LABEL_X}
            y={py(gp) + 4}
            fontSize="10"
            fontFamily={MONO}
            fill="#c0bfba"
            textAnchor="start"
          >
            {gp.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          </text>
        </g>
      ))}

      {/* TP3 */}
      {plan.tp3 != null && (
        <line x1={CL} y1={py(plan.tp3)} x2={CR} y2={py(plan.tp3)}
          stroke="#1a7a5e" strokeWidth="1.6" strokeDasharray="6,4" />
      )}
      {/* TP2 */}
      {plan.tp2 != null && (
        <line x1={CL} y1={py(plan.tp2)} x2={CR} y2={py(plan.tp2)}
          stroke="#2e8a65" strokeWidth="1.6" strokeDasharray="6,4" />
      )}
      {/* TP1 */}
      {plan.tp1 != null && (
        <line x1={CL} y1={py(plan.tp1)} x2={CR} y2={py(plan.tp1)}
          stroke="#52b08a" strokeWidth="1.6" strokeDasharray="6,4" />
      )}
      {/* Hard SL */}
      {plan.hardSl != null && (
        <line x1={CL} y1={py(plan.hardSl)} x2={CR} y2={py(plan.hardSl)}
          stroke="#c0392b" strokeWidth="1.6" strokeDasharray="6,4" />
      )}

      {/* Entry band */}
      {entryY1 != null && entryY2 != null && (
        <>
          <rect x={CL} y={entryY1} width={CR - CL} height={entryY2 - entryY1}
            fill="#2563a8" fillOpacity="0.07" />
          <line x1={CL} y1={entryY1} x2={CR} y2={entryY1}
            stroke="#2563a8" strokeWidth="1.4" strokeDasharray="3,3" />
          <line x1={CL} y1={entryY2} x2={CR} y2={entryY2}
            stroke="#2563a8" strokeWidth="1.4" strokeDasharray="3,3" />
        </>
      )}

      {/* Candlesticks */}
      {candles.map((c, i) => {
        const x = cx(i)
        const isUp = c.c >= c.o
        const color = isUp ? '#1a7a5e' : '#c0392b'
        const bodyTop = py(Math.max(c.o, c.c))
        const bodyBot = py(Math.min(c.o, c.c))
        const bodyH = Math.max(bodyBot - bodyTop, 1)
        return (
          <g key={i}>
            <line x1={x} y1={py(c.h)} x2={x} y2={py(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} />
          </g>
        )
      })}

      {/* Current price marker */}
      {markerY != null && (
        <>
          <line x1={markerX} y1={markerY} x2={CR} y2={markerY}
            stroke="#1a1a18" strokeWidth="1" strokeDasharray="2,2" strokeOpacity="0.4" />
          <circle cx={markerX} cy={markerY} r="3.5" fill="#1a1a18" />
          <text x={LABEL_X} y={markerY + 4} fontSize="11" fontFamily={MONO}
            fontWeight="500" fill="#1a1a18" textAnchor="start">
            {fmtP(plan.currentPrice!)}
          </text>
        </>
      )}

      {/* X-axis month labels */}
      {monthLabels.map((ml, i) => (
        <text key={i} x={ml.x} y={XAXIS_Y} fontSize="11"
          fontFamily={MONO} fill="#9a9a94" textAnchor="middle">
          {ml.label}
        </text>
      ))}
    </svg>
  )
}

// ─── main widget ─────────────────────────────────────────────────────────────
export function TradePlanWidget() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const { data: plans, loading, error } = useApi<TradePlan[]>('/api/trade-plans')

  // Compute before early returns so the hook runs unconditionally (rules of hooks).
  const activePlan = plans?.find(p => p.ticker === selectedTicker) ?? plans?.[0]
  useWidgetSubtitle(activePlan?.updatedAt ? fmtDataDate(activePlan.updatedAt) : undefined)

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-mid" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-mid">Veri alınamadı.</p>
      </div>
    )
  }
  if (!plans?.length) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-mid">Henüz trade plan eklenmedi.</p>
      </div>
    )
  }

  const plan = activePlan!
  const cur = plan.currentPrice

  const levels: Array<{
    label: string
    price: string
    rawPrice: number | null
    dotColor: string
    isEntry?: boolean
  }> = [
    {
      label: 'Giriş Bandı',
      price:
        plan.entryLow != null && plan.entryHigh != null
          ? `${fmtP(plan.entryLow)} – ${fmtP(plan.entryHigh)}`
          : '—',
      rawPrice: plan.entryLow != null && plan.entryHigh != null
        ? (plan.entryLow + plan.entryHigh) / 2
        : null,
      dotColor: '#2563a8',
      isEntry: true,
    },
    { label: 'TP1', price: plan.tp1 != null ? fmtP(plan.tp1) : '—', rawPrice: plan.tp1, dotColor: '#52b08a' },
    { label: 'TP2', price: plan.tp2 != null ? fmtP(plan.tp2) : '—', rawPrice: plan.tp2, dotColor: '#2e8a65' },
    { label: 'TP3', price: plan.tp3 != null ? fmtP(plan.tp3) : '—', rawPrice: plan.tp3, dotColor: '#1a7a5e' },
    { label: 'Hard SL', price: plan.hardSl != null ? fmtP(plan.hardSl) : '—', rawPrice: plan.hardSl, dotColor: '#c0392b' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Ticker header */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-mono font-semibold">{plan.ticker}</span>
          {plan.exchange && (
            <span className="num ml-1.5 text-xs text-mid">· {plan.exchange}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {cur != null && (
            <span className="num text-sm font-medium">{fmtP(cur)}</span>
          )}
          {plans.length > 1 && (
            <select
              value={selectedTicker ?? plan.ticker}
              onChange={e => setSelectedTicker(e.target.value)}
              className="num rounded border border-faint bg-card px-1.5 py-0.5 text-[11px]"
            >
              {plans.map(p => (
                <option key={p.ticker} value={p.ticker}>{p.ticker}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* SVG chart */}
      <TradePlanChart plan={plan} />

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5">
        {plan.entryLow != null && plan.entryHigh != null && (
          <LegendChip color="#2563a8" bg="#eef3fb">Giriş Bandı</LegendChip>
        )}
        {plan.tp1 != null && <LegendChip color="#52b08a" bg="#edf5f2">TP1</LegendChip>}
        {plan.tp2 != null && <LegendChip color="#2e8a65" bg="#e6f1ea">TP2</LegendChip>}
        {plan.tp3 != null && <LegendChip color="#1a7a5e" bg="#ddecdf">TP3</LegendChip>}
        {plan.hardSl != null && <LegendChip color="#c0392b" bg="#fdf0ee">Hard SL</LegendChip>}
      </div>

      {/* Levels table */}
      <div className="border-t border-faint pt-3">
        {levels.map((row, i) => {
          const p = row.rawPrice != null && cur != null
            ? pctStr(row.rawPrice, cur)
            : null
          const isUp = row.rawPrice != null && cur != null
            ? row.rawPrice >= cur
            : true
          return (
            <LevelRow
              key={i}
              dotColor={row.dotColor}
              label={row.label}
              price={row.price}
              pct={row.isEntry ? null : p}
              isUp={isUp}
            />
          )
        })}
      </div>

      {/* Thesis / invalidation note */}
      {(plan.thesis || plan.invalidation) && (
        <div className="border-t border-faint pt-3 text-xs leading-relaxed text-mid space-y-1.5">
          {plan.thesis && (
            <p><span className="font-medium text-ink">Tez:</span> {plan.thesis}</p>
          )}
          {plan.invalidation && (
            <p><span className="font-medium text-ink">Tezi bozan:</span> {plan.invalidation}</p>
          )}
        </div>
      )}
    </div>
  )
}
