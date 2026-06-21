import type { HeatmapSector } from '@/lib/api-types'

const GREEN = '#1a7a5e'
const RED   = '#c0392b'

// Fixed dark text per direction (no magnitude-based switching) kept inside a
// shallow alpha range (0.05–0.10) so the tint/text combo clears WCAG AA
// (≥4.5:1) across the whole |pct| range — verified by hand against the
// luminance formula before picking these numbers.
export function heatStyle(pct: number): { background: string; color: string; border: string } {
  const abs = Math.min(Math.abs(pct) / 4, 1)
  const alpha = 0.05 + abs * 0.05
  const color = pct >= 0 ? GREEN : RED
  const rgb = pct >= 0 ? '26,122,94' : '192,57,43'
  return {
    background: `rgba(${rgb},${alpha})`,
    color,
    border: `1px solid ${color}33`,
  }
}

export function HeatmapTile({ s }: { s: HeatmapSector }) {
  const style = heatStyle(s.change_pct)
  return (
    <div
      className="flex flex-col justify-between rounded p-2 text-xs"
      style={style}
      title={s.note ?? undefined}
    >
      <div className="font-medium leading-tight">{s.name}</div>
      <div className="num mt-1 font-medium">
        {s.change_pct >= 0 ? '↑' : '↓'} {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
      </div>
    </div>
  )
}
