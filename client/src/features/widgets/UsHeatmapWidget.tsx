import { Loader2 } from 'lucide-react'

import type { Heatmap } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { HeatmapTile } from './heatmap-tile'

export function UsHeatmapWidget() {
  const { data, loading, error } = useApi<Heatmap | null>('/api/heatmaps?market=US')

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
      {data.sectors.map((s, i) => <HeatmapTile key={i} s={s} />)}
    </div>
  )
}
