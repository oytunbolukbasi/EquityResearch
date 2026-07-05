interface RiskRewardBarProps {
  stopLoss: number
  entryLow: number
  entryHigh: number
  target1: number
  currentPrice?: number | null
  direction: 'long' | 'short' | string | null
  className?: string
}

export function RiskRewardBar({
  stopLoss, entryLow, entryHigh, target1, currentPrice, direction, className = '',
}: RiskRewardBarProps) {
  const lo = Math.min(stopLoss, target1)
  const hi = Math.max(stopLoss, target1)
  if (hi === lo) return null

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
  const isShort = direction === 'short'
  const gradient = isShort
    ? 'linear-gradient(90deg, var(--green) 0%, var(--faint2) 45%, var(--red) 100%)'
    : 'linear-gradient(90deg, var(--red) 0%, var(--faint2) 45%, var(--green) 100%)'

  const entryLeft  = Math.min(pct(entryLow), pct(entryHigh))
  const entryWidth = Math.abs(pct(entryHigh) - pct(entryLow))

  // R:R: giriş bandı ortalaması baz alınır
  const entryMid = (entryLow + entryHigh) / 2
  const risk   = isShort ? stopLoss - entryMid : entryMid - stopLoss
  const reward = isShort ? entryMid - target1  : target1  - entryMid
  const rr = risk > 0 && reward > 0 ? reward / risk : null

  const tooltip = [
    `SL ${stopLoss}`,
    `Giriş ${entryLow}–${entryHigh}`,
    `TP1 ${target1}`,
    currentPrice != null && `Güncel ${currentPrice}`,
    rr != null && `R:R 1:${rr.toFixed(1)}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`group flex flex-col items-center gap-1 shrink-0 ${className}`} title={tooltip}>
      {/* R:R badge */}
      {rr != null && (
        <span className="num rounded-full bg-faint2 px-1.5 py-px text-[9px] font-semibold leading-tight text-mid">
          1:{rr.toFixed(1)}
        </span>
      )}

      {/* gradient bar */}
      <div
        className="relative h-1.5 w-20 rounded-full"
        style={{ background: gradient }}
      >
        {/* giriş bandı */}
        <div
          className="absolute top-0 h-1.5 rounded-full bg-ink/15"
          style={{ left: `${entryLeft}%`, width: `${Math.max(entryWidth, 3)}%` }}
        />
        {/* güncel fiyat noktası */}
        {currentPrice != null && (
          <div
            className="absolute -top-[3px] size-3 rounded-full border-2 border-white bg-ink shadow-sm transition-transform group-hover:scale-110"
            style={{ left: `calc(${pct(currentPrice)}% - 6px)` }}
          />
        )}
      </div>
    </div>
  )
}
