import { Loader2 } from 'lucide-react'

import type { Idea } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'

function Loading() {
  return (
    <div className="flex h-32 items-center justify-center">
      <Loader2 className="size-5 animate-spin text-mid" />
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center">
      <p className="text-sm text-mid">{children}</p>
    </div>
  )
}

function fmtN(n: number | null, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (direction === 'long')
    return (
      <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
        style={{ background: '#edf5f2', color: '#1a7a5e' }}>
        LONG
      </span>
    )
  if (direction === 'short')
    return (
      <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
        style={{ background: '#fdf0ee', color: '#c0392b' }}>
        SHORT
      </span>
    )
  return <span className="text-mid text-xs">—</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:     { label: 'Aktif',  bg: '#eef3fb', color: '#2563a8' },
    hit_target: { label: 'Hedef', bg: '#edf5f2', color: '#1a7a5e' },
    stopped:    { label: 'SL',    bg: '#fdf0ee', color: '#c0392b' },
    watch:      { label: 'İzle',  bg: '#fef8e9', color: '#9a6200' },
  }
  const cfg = map[status] ?? { label: status, bg: '#f5f4f0', color: '#9a9a94' }
  return (
    <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

export function IdeasTableWidget() {
  const { data: ideas, loading, error } = useApi<Idea[]>('/api/ideas')

  if (loading) return <Loading />
  if (error) return <Empty>Veri alınamadı.</Empty>
  if (!ideas?.length) return <Empty>Henüz fikir eklenmedi.</Empty>

  return (
    <div className="-m-4 h-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-faint bg-card">
            <th className="num px-4 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Hisse</th>
            <th className="num px-3 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Yön</th>
            <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium">Giriş</th>
            <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium">SL</th>
            <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium">TP1</th>
            <th className="num px-4 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Durum</th>
          </tr>
        </thead>
        <tbody>
          {ideas.map(idea => (
            <tr key={idea.id} className="border-b border-faint2 hover:bg-bg">
              <td className="px-4 py-2.5">
                <div className="font-mono font-semibold text-sm">{idea.ticker}</div>
                {idea.exchange && (
                  <div className="num text-[10px] text-mid">{idea.exchange}</div>
                )}
              </td>
              <td className="px-3 py-2.5">
                <DirectionBadge direction={idea.direction} />
              </td>
              <td className="num px-3 py-2.5 text-right text-xs">
                {idea.entryLow != null && idea.entryHigh != null
                  ? `${fmtN(idea.entryLow, 0)}–${fmtN(idea.entryHigh, 0)}`
                  : fmtN(idea.entryLow, 0)}
              </td>
              <td className="num px-3 py-2.5 text-right text-xs" style={{ color: '#c0392b' }}>
                {fmtN(idea.stopLoss, 0)}
              </td>
              <td className="num px-3 py-2.5 text-right text-xs" style={{ color: '#1a7a5e' }}>
                {fmtN(idea.target1, 0)}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={idea.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
