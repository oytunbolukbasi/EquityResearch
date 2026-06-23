import { Loader2 } from 'lucide-react'

import type { Heatmap } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { useDateFilter, withDate } from '@/features/dashboard/date-filter'
import { HeatmapTile } from './heatmap-tile'

export function BistHeatmapWidget() {
  const { date } = useDateFilter()
  // The /api/heatmaps route returns a single object when called with only
  // `market`, but an array once `date` is also passed — normalize both shapes.
  const { data: raw, loading, error } = useApi<Heatmap | Heatmap[] | null>(
    withDate('/api/heatmaps?market=BIST', date),
  )
  const data = Array.isArray(raw) ? raw[0] ?? null : raw

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
        <p className="text-sm text-mid">
          {date ? 'Bu tarihte veri yok.' : 'Henüz BIST heatmap verisi eklenmedi.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {data.sectors.map((s, i) => <HeatmapTile key={i} s={s} />)}
    </div>
  )
}
