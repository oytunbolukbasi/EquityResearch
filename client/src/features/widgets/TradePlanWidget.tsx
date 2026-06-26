import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { TradePlan } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { useSelectedTicker } from '@/features/dashboard/selected-ticker'
import { TradePlanChart } from './TradePlanChart'
import { StatusTabs, type StatusTab } from './StatusTabs'

function N2(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function pctStr(price: number, current: number): string {
  const p = ((price - current) / current) * 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
}

// ─── legend chip ─────────────────────────────────────────────────────────────
function LegendChip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
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

// ─── levels table row ─────────────────────────────────────────────────────────
function LevelRow({
  dotColor, label, price, pct, isUp,
}: {
  dotColor: string; label: string; price: string; pct: string | null; isUp: boolean
}) {
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
            style={isUp
              ? { background: '#edf5f2', color: '#1a7a5e' }
              : { background: '#fdf0ee', color: '#c0392b' }}
          >
            {pct}
          </span>
        )}
      </span>
    </div>
  )
}

// ─── main widget ─────────────────────────────────────────────────────────────
export function TradePlanWidget() {
  const [tab, setTab] = useState<StatusTab>('active')
  const [localTicker, setLocalTicker] = useState<string | null>(null)
  const { data: plans, loading, error } = useApi<TradePlan[]>('/api/trade-plans')
  const { selectedTicker: globalTicker } = useSelectedTicker()

  function changeTab(t: StatusTab) {
    setTab(t)
    setLocalTicker(null)
  }

  // A row clicked in Pozisyon Fikirleri sets the shared selectedTicker — jump
  // to that ticker's plan and whichever tab (Aktif/Geçmiş) it actually lives
  // in, regardless of what was showing before.
  useEffect(() => {
    if (!globalTicker || !plans) return
    const match = plans.find(p => p.ticker === globalTicker)
    if (!match) return
    setTab(match.status === 'stopped' ? 'history' : 'active')
    setLocalTicker(globalTicker)
  }, [globalTicker, plans])

  const visible = plans?.filter(p => tab === 'active' ? p.status === 'active' : p.status === 'stopped')
  const activePlan = visible?.find(p => p.ticker === localTicker) ?? visible?.[0]

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

  return (
    <div>
      <StatusTabs tab={tab} onChange={changeTab} />
      {!visible?.length ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-mid">{tab === 'active' ? 'Aktif plan yok.' : 'Geçmiş plan yok.'}</p>
        </div>
      ) : (
        <TradePlanBody plan={activePlan!} plans={visible} onSelect={setLocalTicker} />
      )}
    </div>
  )
}

function TradePlanBody({
  plan, plans, onSelect,
}: {
  plan: TradePlan
  plans: TradePlan[]
  onSelect: (ticker: string) => void
}) {
  const cur = plan.currentPrice

  const levels = [
    {
      label: 'Giriş Bandı',
      price: plan.entryLow != null && plan.entryHigh != null
        ? `${N2(plan.entryLow)} – ${N2(plan.entryHigh)}`
        : plan.entryLow != null ? N2(plan.entryLow) : '—',
      rawPrice: plan.entryLow != null && plan.entryHigh != null
        ? (plan.entryLow + plan.entryHigh) / 2 : plan.entryLow ?? null,
      dotColor: '#2563a8',
      isEntry: true,
    },
    { label: 'TP1',     price: plan.tp1    != null ? N2(plan.tp1)    : '—', rawPrice: plan.tp1    ?? null, dotColor: '#52b08a' },
    { label: 'TP2',     price: plan.tp2    != null ? N2(plan.tp2)    : '—', rawPrice: plan.tp2    ?? null, dotColor: '#2e8a65' },
    { label: 'TP3',     price: plan.tp3    != null ? N2(plan.tp3)    : '—', rawPrice: plan.tp3    ?? null, dotColor: '#1a7a5e' },
    { label: 'Hard SL', price: plan.hardSl != null ? N2(plan.hardSl) : '—', rawPrice: plan.hardSl ?? null, dotColor: '#c0392b' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Ticker header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold">{plan.ticker}</span>
          {plan.exchange && (
            <span className="num text-xs text-mid">· {plan.exchange}</span>
          )}
          {plan.status === 'stopped' && (
            <span
              className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: '#fdf0ee', color: '#c0392b' }}
            >
              SL
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {cur != null && (
            <span className="num text-sm font-medium">{N2(cur)}</span>
          )}
          {plans.length > 1 && (
            <select
              value={plan.ticker}
              onChange={e => onSelect(e.target.value)}
              className="num rounded border border-faint bg-card px-2 py-1 text-xs"
            >
              {plans.map(p => (
                <option key={p.ticker} value={p.ticker}>{p.ticker}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* lightweight-charts chart */}
      <TradePlanChart plan={plan} />

      {/* Legend chips */}
      <div className="flex flex-wrap gap-1.5">
        {plan.entryLow  != null && <LegendChip color="#2563a8" bg="#eef3fb">Giriş Bandı</LegendChip>}
        {plan.tp1       != null && <LegendChip color="#52b08a" bg="#edf5f2">TP1</LegendChip>}
        {plan.tp2       != null && <LegendChip color="#2e8a65" bg="#e6f1ea">TP2</LegendChip>}
        {plan.tp3       != null && <LegendChip color="#1a7a5e" bg="#ddecdf">TP3</LegendChip>}
        {plan.hardSl    != null && <LegendChip color="#c0392b" bg="#fdf0ee">Hard SL</LegendChip>}
      </div>

      {/* Levels table */}
      <div className="border-t border-faint pt-3">
        {levels.map((row, i) => {
          const pct = !('isEntry' in row) && row.rawPrice != null && cur != null
            ? pctStr(row.rawPrice, cur) : null
          const isUp = row.rawPrice != null && cur != null ? row.rawPrice >= cur : true
          return (
            <LevelRow
              key={i}
              dotColor={row.dotColor}
              label={row.label}
              price={row.price}
              pct={pct}
              isUp={isUp}
            />
          )
        })}
      </div>

      {/* Thesis / invalidation */}
      {(plan.thesis || plan.invalidation) && (
        <div className="border-t border-faint pt-3 space-y-1.5 text-xs leading-relaxed text-mid">
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
