import { useEffect, useRef } from 'react'
import {
  createChart,
  BarSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
} from 'lightweight-charts'

import type { TradePlan } from '@/lib/api-types'

const GREEN = '#1a7a5e'
const RED   = '#c0392b'
const BLUE  = '#2563a8'
const MONO  = "'JetBrains Mono', ui-monospace, monospace"

function N2(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function pct(price: number, current: number): number {
  return ((price - current) / current) * 100
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return dateStr(d)
}

interface Level {
  key: string
  price: number
  label: string
  color: string
  bg: string
}

// Tints matched to the legend chips / levels table in TradePlanWidget so the
// off-chart badges read as the same level, not a different visual language.
function buildLevels(plan: TradePlan): Level[] {
  const levels: Level[] = []
  if (plan.entryHigh != null) levels.push({ key: 'entryHigh', price: plan.entryHigh, label: 'Giriş', color: BLUE, bg: '#eef3fb' })
  if (plan.entryLow != null && plan.entryLow !== plan.entryHigh)
    levels.push({ key: 'entryLow', price: plan.entryLow, label: 'Giriş', color: BLUE, bg: '#eef3fb' })
  if (plan.tp1 != null) levels.push({ key: 'tp1', price: plan.tp1, label: 'TP1', color: '#52b08a', bg: '#edf5f2' })
  if (plan.tp2 != null) levels.push({ key: 'tp2', price: plan.tp2, label: 'TP2', color: '#2e8a65', bg: '#e6f1ea' })
  if (plan.tp3 != null) levels.push({ key: 'tp3', price: plan.tp3, label: 'TP3', color: GREEN, bg: '#ddecdf' })
  if (plan.hardSl != null) levels.push({ key: 'hardSl', price: plan.hardSl, label: 'Hard SL', color: RED, bg: '#fdf0ee' })
  return levels
}

export function TradePlanChart({ plan }: { plan: TradePlan }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)

  // ─── Y-axis range: candle H/L only (TP/SL never stretch the axis) ──────────
  const candleHL = (plan.priceHistory ?? []).flatMap(c => [c.h, c.l])
  const basis    = candleHL.length ? candleHL : plan.currentPrice != null ? [plan.currentPrice] : []
  const priceMin = basis.length ? Math.min(...basis) : 0
  const priceMax = basis.length ? Math.max(...basis) : 100
  const rawPad   = (priceMax - priceMin) * 0.08
  const pad      = rawPad > 0 ? rawPad : (priceMax || 1) * 0.05
  const visibleMin = priceMin - pad
  const visibleMax = priceMax + pad

  const levels    = buildLevels(plan)
  const inRange   = levels.filter(l => l.price >= visibleMin && l.price <= visibleMax)
  const aboveRange = levels
    .filter(l => l.price > visibleMax)
    .sort((a, b) => b.price - a.price) // furthest first, nearest-to-chart last
  const belowRange = levels
    .filter(l => l.price < visibleMin)
    .sort((a, b) => a.price - b.price) // furthest first, nearest-to-chart last

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9a9a94',
        fontFamily: MONO,
      },
      grid: {
        vertLines: { color: '#eeede9', style: LineStyle.Solid },
        horzLines: { color: '#eeede9', style: LineStyle.Solid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { locale: 'tr-TR' },
    })

    chartRef.current = chart

    // ─── OHLC bar series ──────────────────────────────────────────────────────
    const barSeries = chart.addSeries(BarSeries, {
      upColor:   GREEN,
      downColor: RED,
    })

    const candles = (plan.priceHistory ?? []).map(c => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      time:  (c.t.includes('T') ? c.t.split('T')[0] : c.t) as any,
      open:  c.o,
      high:  c.h,
      low:   c.l,
      close: c.c,
    }))

    if (candles.length) barSeries.setData(candles)

    // ─── Invisible anchor series to force Y-axis to show the candle range ────
    // Two transparent LineSeries, one anchored at visibleMin and one at
    // visibleMax. They have no visible markers so they're completely hidden,
    // but their data points participate in the auto-scale calculation.
    const t0     = candles[0]?.time ?? dateStr(new Date())
    const tLast  = candles[candles.length - 1]?.time ?? t0
    const tNext  = tLast === t0 ? addDays(t0 as string, 1) : tLast

    const anchorOpts = {
      color: 'rgba(0,0,0,0)',
      lineWidth: 1 as const,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    }

    const anchorLo = chart.addSeries(LineSeries, anchorOpts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anchorLo.setData([{ time: t0 as any, value: visibleMin }])

    const anchorHi = chart.addSeries(LineSeries, anchorOpts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anchorHi.setData([{ time: tNext as any, value: visibleMax }])

    chart.timeScale().fitContent()

    // ─── Price lines — only for levels inside the visible range ─────────────
    for (const l of inRange) {
      barSeries.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${l.label} — ${N2(l.price)}`,
      })
    }

    return () => {
      chart.remove()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  return (
    <div style={{ height: 360, position: 'relative' }}>
      <div ref={containerRef} style={{ height: 360, position: 'absolute', inset: 0 }} />

      {aboveRange.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
          {aboveRange.map(l => (
            <OffChartBadge key={l.key} level={l} current={plan.currentPrice} fallbackDirection="up" />
          ))}
        </div>
      )}

      {belowRange.length > 0 && (
        <div className="absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1">
          {belowRange.map(l => (
            <OffChartBadge key={l.key} level={l} current={plan.currentPrice} fallbackDirection="down" />
          ))}
        </div>
      )}
    </div>
  )
}

function OffChartBadge({
  level, current, fallbackDirection,
}: {
  level: Level
  current: number | null
  fallbackDirection: 'up' | 'down'
}) {
  const p = current != null ? pct(level.price, current) : null
  // Arrow reflects the level's direction from the current price (matches the
  // sign of the % shown); falls back to the chart-edge side if no current price.
  const isUp = p != null ? p >= 0 : fallbackDirection === 'up'
  return (
    <div
      className="num flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
      style={{ background: level.bg, color: level.color, border: `1px solid ${level.color}33` }}
    >
      <span>{isUp ? '↑' : '↓'}</span>
      <span className="font-semibold">{level.label}</span>
      <span>{N2(level.price)}</span>
      {p != null && <span className="opacity-70">({p >= 0 ? '+' : ''}{p.toFixed(1)}%)</span>}
    </div>
  )
}
