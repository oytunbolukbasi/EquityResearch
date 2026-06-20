import { Loader2 } from 'lucide-react'

import type { Heatmap, HeatmapSector } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { fmtDataDate, useWidgetSubtitle } from '@/features/dashboard/widget-subtitle'

function heatStyle(pct: number): { background: string; color: string } {
  const abs = Math.min(Math.abs(pct) / 4, 1)
  if (pct >= 0) {
    return {
      background: `rgba(26,122,94,${0.08 + abs * 0.28})`,
      color: pct > 1.5 ? '#1a7a5e' : '#2e8a65',
    }
  }
  return {
    background: `rgba(192,57,43,${0.08 + abs * 0.28})`,
    color: pct < -1.5 ? '#c0392b' : '#d4665c',
  }
}

function Tile({ s }: { s: HeatmapSector }) {
  const style = heatStyle(s.change_pct)
  return (
    <div
      className="flex flex-col justify-between rounded p-2 text-xs"
      style={style}
      title={s.note ?? undefined}
    >
      <div className="font-medium leading-tight">{s.name}</div>
      <div className="num mt-1 font-medium">
        {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
      </div>
    </div>
  )
}

export function UsHeatmapWidget() {
  const { data, loading, error } = useApi<Heatmap | null>('/api/heatmaps?market=US')

  useWidgetSubtitle(data?.date ? fmtDataDate(data.date) : undefined)

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-mid" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-mid">Veri alınamadı.</p>
      </div>
    )
  }
  if (!data?.sectors?.length) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-mid">Henüz ABD heatmap verisi eklenmedi.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {data.sectors.map((s, i) => <Tile key={i} s={s} />)}
    </div>
  )
}
