import { useEffect, useRef } from 'react'
import {
  createChart,
  BarSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
} from 'lightweight-charts'

import type { TradePlan } from '@/lib/api-types'
import { useTheme } from '@/lib/theme'

const INTER = "'Inter', ui-sans-serif, system-ui, sans-serif"

/**
 * How many bar-widths of empty space the right edge needs so that no bar hides
 * behind a level label.
 *
 * The label width is measured with a 2D canvas in the chart's own font instead
 * of estimated from character count — "Giriş — 101,50" and "Hard SL — 93,00"
 * differ by more than their length suggests, and a wrong estimate fails in the
 * direction that puts bars back under the text.
 */
function rightPadBars(
  titles: string[],
  paneWidth: number,
  barCount: number,
): number {
  if (!titles.length || paneWidth <= 0 || barCount <= 0) return 0

  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return 0
  // The library draws these at 12px in the chart font.
  ctx.font = `12px ${INTER}`

  const widest = Math.max(...titles.map((t) => ctx.measureText(t).width))
  // The label sits in a padded box. Measuring at 12px when the library draws at
  // ~11px overshoots slightly, and that is the safe direction: too much margin
  // is a wider gap, too little puts bars back under the text.
  const needed = widest + 16

  // Solve for the padding at the FINAL scale, not the current one. Padding the
  // range compresses the bars, so a pad derived from today's bar spacing comes
  // out short by exactly the compression it causes — measured at 18px of
  // leftover overlap before this was written as a ratio.
  //
  // We want the data to occupy (paneWidth - needed), so the pad in bars is
  // needed / finalBarSpacing = barCount * needed / (paneWidth - needed).
  const usable = paneWidth - needed
  if (usable <= 0) return Math.floor(barCount / 2)

  // Never give away more than half the chart: on a very narrow panel a full
  // clearance leaves no room for the bars, and a squeezed chart is worse than
  // an overlapped label.
  return Math.min(Math.ceil((barCount * needed) / usable), Math.floor(barCount / 2))
}

// lightweight-charts renders to canvas and can't consume CSS custom properties,
// so we resolve the active theme's tokens to concrete colour strings at build
// time. We read only *concrete* tokens (never the var()-aliased ones like --up)
// because getComputedStyle returns a custom property's specified value, which
// for `--up: var(--green)` would come back unresolved.
function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#000'
}

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
  colorVar: string // concrete CSS token, e.g. '--tp1' — used for chart lines + DOM text
  tintVar: string  // tint token, e.g. '--tp1-tint' — used for DOM badge background
}

// Tokens matched to the legend chips / levels table in TradePlanWidget so the
// off-chart badges read as the same level, not a different visual language.
function buildLevels(plan: TradePlan): Level[] {
  const levels: Level[] = []
  if (plan.entryHigh != null) levels.push({ key: 'entryHigh', price: plan.entryHigh, label: 'Giriş', colorVar: '--blue', tintVar: '--info-tint' })
  if (plan.entryLow != null && plan.entryLow !== plan.entryHigh)
    levels.push({ key: 'entryLow', price: plan.entryLow, label: 'Giriş', colorVar: '--blue', tintVar: '--info-tint' })
  if (plan.tp1 != null) levels.push({ key: 'tp1', price: plan.tp1, label: 'TP1', colorVar: '--tp1', tintVar: '--tp1-tint' })
  if (plan.tp2 != null) levels.push({ key: 'tp2', price: plan.tp2, label: 'TP2', colorVar: '--tp2', tintVar: '--tp2-tint' })
  if (plan.tp3 != null) levels.push({ key: 'tp3', price: plan.tp3, label: 'TP3', colorVar: '--tp3', tintVar: '--tp3-tint' })
  if (plan.hardSl != null) levels.push({ key: 'hardSl', price: plan.hardSl, label: 'Hard SL', colorVar: '--red', tintVar: '--down-tint' })
  return levels
}

export function TradePlanChart({ plan }: { plan: TradePlan }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const { theme }    = useTheme()

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

    // Resolve the active theme's palette from CSS custom properties. The .dark
    // class is applied synchronously by ThemeProvider before this effect runs,
    // so these reads reflect the current theme even right after a toggle.
    // One colour for every bar — see --chart-bar in index.css for why, and why
    // it carries a different value per theme.
    const bar  = cssVar(container, '--chart-bar')
    const axis = cssVar(container, '--chart-axis')

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: axis,
        fontFamily: INTER,
      },
      // No grid. The level lines (giriş bandı, TP merdiveni, hard SL) are the
      // only horizontals worth reading here, and a full grid competed with them.
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: { locale: 'tr-TR' },
    })

    chartRef.current = chart

    // ─── Bar series ──────────────────────────────────────────────────────────
    const candleSeries = chart.addSeries(BarSeries, {
      upColor:     bar,
      downColor:   bar,
      openVisible: true,
      thinBars:    false,
      // No last-price label or line. The last bar is the content round's close,
      // while the number above the chart is the sheet's delayed live price —
      // two different prices, and the axis label made the older one look like
      // the current quote. Hovering a bar still shows its date and values; this
      // chart is here to place entry and targets, not to quote.
      lastValueVisible: false,
      priceLineVisible: false,
    })

    // lightweight-charts requires ascending time order and silently fails to
    // render otherwise — priceHistory isn't guaranteed to arrive sorted.
    const sortedHistory = [...(plan.priceHistory ?? [])]
      .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())

    const candles = sortedHistory.map(c => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      time:  (c.t.includes('T') ? c.t.split('T')[0] : c.t) as any,
      open:  c.o,
      high:  c.h,
      low:   c.l,
      close: c.c,
    }))

    if (candles.length) candleSeries.setData(candles)

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
    const titles = inRange.map((l) => `${l.label} — ${N2(l.price)}`)

    for (const [i, l] of inRange.entries()) {
      candleSeries.createPriceLine({
        price: l.price,
        color: cssVar(container, l.colorVar),
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: titles[i],
      })
    }

    // ─── Keep the bars out from under the level labels ──────────────────────
    //
    // A price line's title is drawn INSIDE the pane, pinned to its right edge —
    // it is not part of the price scale, so the library reserves no room for it.
    // `fitContent()` then spreads the bars across the full width and the most
    // recent ones, the ones you actually came to look at, end up behind
    // "Giriş — 101,50" and "Hard SL — 93,00".
    //
    // So we widen the logical range past the last bar by however many bars it
    // takes to clear the widest label. Measured with the canvas rather than
    // guessed at, because the text is Turkish and variable ("TP1 — 116,00" is
    // not "Hard SL — 93,00"), and the panel is resizable.
    if (candles.length) {
      const pad = rightPadBars(titles, chart.timeScale().width(), candles.length)
      if (pad > 0) {
        chart.timeScale().setVisibleLogicalRange({ from: 0, to: candles.length - 1 + pad })
      }
    }

    return () => {
      chart.remove()
      chartRef.current = null
    }
    // Rebuild on theme change so canvas colours re-resolve from the new palette.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, theme])

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
      style={{
        background: `var(${level.tintVar})`,
        color: `var(${level.colorVar})`,
        border: `1px solid color-mix(in srgb, var(${level.colorVar}) 20%, transparent)`,
      }}
    >
      <span>{isUp ? '↑' : '↓'}</span>
      <span className="font-semibold">{level.label}</span>
      <span>{N2(level.price)}</span>
      {p != null && <span className="opacity-70">({p >= 0 ? '+' : ''}{p.toFixed(1)}%)</span>}
    </div>
  )
}
