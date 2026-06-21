import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
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

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return dateStr(d)
}

export function TradePlanChart({ plan }: { plan: TradePlan }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)

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

    // ─── Compute Y-axis anchor range ────────────────────────────────────────
    // Include candle H/L, current price, entry band, hard SL, and nearest TP
    // only. TP2/TP3 (far targets) are excluded from the anchor so candles fill
    // the chart height like a proper daily chart instead of being compressed.
    const nearestTp = plan.tp1 ?? plan.tp2 ?? plan.tp3
    const anchorPrices = [
      ...(plan.priceHistory ?? []).flatMap(c => [c.h, c.l]),
      plan.currentPrice,
      plan.entryLow,
      plan.entryHigh,
      nearestTp,
      plan.hardSl,
    ].filter((v): v is number => v != null)

    const priceMin = anchorPrices.length ? Math.min(...anchorPrices) : 0
    const priceMax = anchorPrices.length ? Math.max(...anchorPrices) : 100
    const pad      = (priceMax - priceMin) * 0.10

    // ─── Candlestick series ──────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         GREEN,
      downColor:       RED,
      borderUpColor:   GREEN,
      borderDownColor: RED,
      wickUpColor:     GREEN,
      wickDownColor:   RED,
    })

    const candles = (plan.priceHistory ?? []).map(c => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      time:  (c.t.includes('T') ? c.t.split('T')[0] : c.t) as any,
      open:  c.o,
      high:  c.h,
      low:   c.l,
      close: c.c,
    }))

    if (candles.length) candleSeries.setData(candles)

    // ─── Invisible anchor series to force Y-axis to show full price range ────
    // Two transparent LineSeries, one anchored at priceMin−pad and one at
    // priceMax+pad. They have no visible markers so they're completely hidden,
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
    anchorLo.setData([{ time: t0 as any, value: priceMin - pad }])

    const anchorHi = chart.addSeries(LineSeries, anchorOpts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anchorHi.setData([{ time: tNext as any, value: priceMax + pad }])

    chart.timeScale().fitContent()

    // ─── Price lines ─────────────────────────────────────────────────────────
    const addLine = (
      price: number | null | undefined,
      color: string,
      label: string,
    ) => {
      // Builds the title from `price` internally so a null price short-circuits
      // before any formatting runs (N2(null) would throw and crash the chart).
      if (price == null) return
      candleSeries.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${label} — ${N2(price)}`,
      })
    }

    addLine(plan.tp3,    '#1a7a5e', 'TP3')
    addLine(plan.tp2,    '#2e8a65', 'TP2')
    addLine(plan.tp1,    '#52b08a', 'TP1')
    addLine(plan.hardSl, RED,       'Hard SL')

    if (plan.entryHigh != null && plan.entryLow != null && plan.entryHigh !== plan.entryLow) {
      addLine(plan.entryHigh, BLUE, 'Giriş')
      addLine(plan.entryLow,  BLUE, 'Giriş')
    } else if (plan.entryLow != null) {
      addLine(plan.entryLow, BLUE, 'Giriş')
    }

    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, [plan])

  return (
    <div
      ref={containerRef}
      style={{ height: 360, position: 'relative' }}
    />
  )
}
