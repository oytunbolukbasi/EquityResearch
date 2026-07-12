import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { IoOpenOutline } from 'react-icons/io5'

import type { Idea, TradePlan } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { useSelectedTicker } from '@/features/dashboard/selected-ticker'
import { TradePlanChart } from './TradePlanChart'
import { StatusTabs, type StatusTab } from './StatusTabs'

const HISTORY_STATUSES = new Set(['stopped', 'tp1_hit', 'tp2_hit', 'tp3_hit'])

function N2(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function pctStr(price: number, current: number): string {
  const p = ((price - current) / current) * 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
}

// TradingView's own exchange codes don't always match ours 1:1 (e.g. our
// "XETRA" vs their "XETR") — map the ones that differ, pass the rest through.
const TV_EXCHANGE_MAP: Record<string, string> = {
  BIST: 'BIST',
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  XETRA: 'XETR',
  XETR: 'XETR',
}

function tvChartUrl(ticker: string, exchange: string | null): string {
  const tvExchange = exchange ? (TV_EXCHANGE_MAP[exchange.toUpperCase()] ?? exchange) : ''
  const symbol = tvExchange ? `${tvExchange}:${ticker}` : ticker
  return `https://tr.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`
}

// ─── legend chip (label + price + optional %) ─────────────────────────────────
function LegendChip({
  color, bg, label, price, pct,
}: {
  color: string; bg: string; label: string; price: string; pct: string | null
}) {
  return (
    <span
      className="num inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: bg, color }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span>{label}</span>
      <span className="font-semibold">{price}</span>
      {pct && <span className="opacity-70">{pct}</span>}
    </span>
  )
}

// ─── main widget ─────────────────────────────────────────────────────────────
export function TradePlanWidget() {
  const [tab, setTab] = useState<StatusTab>('active')
  const [localTicker, setLocalTicker] = useState<string | null>(null)
  const { data: plans, loading, error } = useApi<TradePlan[]>('/api/trade-plans')
  // Ideas are the source of truth for a ticker's real status/recency — a
  // trade_plan's own `status` column drifts (currentPrice updates keep pushing
  // updatedAt while status stays 'active' even after the idea went terminal),
  // which is why a past idea like ORCL used to surface as the default plan.
  const { data: ideas } = useApi<Idea[]>('/api/ideas')
  const { selectedTicker: globalTicker } = useSelectedTicker()

  // ticker (uppercased) → its latest idea. Falls back to the plan's own status
  // when no idea exists for that ticker (e.g. a plan added without an idea).
  const ideaByTicker = new Map((ideas ?? []).map(i => [i.ticker.toUpperCase(), i]))
  const effStatus = (p: TradePlan) => ideaByTicker.get(p.ticker.toUpperCase())?.status ?? p.status

  function changeTab(t: StatusTab) {
    setTab(t)
    setLocalTicker(null)
  }

  useEffect(() => {
    if (!globalTicker || !plans) return
    const match = plans.find(p => p.ticker === globalTicker)
    if (!match) return
    setTab(HISTORY_STATUSES.has(effStatus(match)) ? 'history' : 'active')
    setLocalTicker(globalTicker)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTicker, plans, ideas])

  const visible = plans?.filter(p => tab === 'active' ? !HISTORY_STATUSES.has(effStatus(p)) : HISTORY_STATUSES.has(effStatus(p)))

  // Default (no explicit selection): on the Active tab, the plan of the most
  // recent-dated active idea. /api/ideas is already ordered date DESC, so the
  // first non-terminal idea with a visible plan wins. Falls back to visible[0].
  function pickDefault(): TradePlan | undefined {
    if (!visible?.length) return undefined
    const local = visible.find(p => p.ticker === localTicker)
    if (local) return local
    if (tab === 'active' && ideas) {
      for (const idea of ideas) {
        if (HISTORY_STATUSES.has(idea.status)) continue
        const p = visible.find(v => v.ticker.toUpperCase() === idea.ticker.toUpperCase())
        if (p) return p
      }
    }
    return visible[0]
  }
  const activePlan = pickDefault()

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
        <TradePlanBody plan={activePlan!} plans={visible} onSelect={setLocalTicker} effStatus={effStatus(activePlan!)} />
      )}
    </div>
  )
}

function TradePlanBody({
  plan, plans, onSelect, effStatus,
}: {
  plan: TradePlan
  plans: TradePlan[]
  onSelect: (ticker: string) => void
  effStatus: string
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
      color: 'var(--info)', tint: 'var(--info-tint)',
      isEntry: true,
    },
    { label: 'TP1',     price: plan.tp1    != null ? N2(plan.tp1)    : '—', rawPrice: plan.tp1    ?? null, color: 'var(--tp1)', tint: 'var(--tp1-tint)' },
    { label: 'TP2',     price: plan.tp2    != null ? N2(plan.tp2)    : '—', rawPrice: plan.tp2    ?? null, color: 'var(--tp2)', tint: 'var(--tp2-tint)' },
    { label: 'TP3',     price: plan.tp3    != null ? N2(plan.tp3)    : '—', rawPrice: plan.tp3    ?? null, color: 'var(--tp3)', tint: 'var(--tp3-tint)' },
    { label: 'Hard SL', price: plan.hardSl != null ? N2(plan.hardSl) : '—', rawPrice: plan.hardSl ?? null, color: 'var(--down)', tint: 'var(--down-tint)' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Ticker header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">{plan.ticker}</span>
          {plan.exchange && (
            <span className="num text-xs text-mid">· {plan.exchange}</span>
          )}
          <a
            href={tvChartUrl(plan.ticker, plan.exchange)}
            target="_blank"
            rel="noopener noreferrer"
            title="TradingView'da aç"
            className="flex items-center p-1 -m-1 text-mid hover:text-ink transition-colors [transition-duration:0.15s]"
          >
            <IoOpenOutline size={14} />
          </a>
          {HISTORY_STATUSES.has(effStatus) && (() => {
            const isStop = effStatus === 'stopped'
            const label = isStop
              ? 'SL'
              : effStatus === 'tp1_hit' ? 'TP1'
              : effStatus === 'tp2_hit' ? 'TP2'
              : 'TP3'
            return (
              <span
                className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={isStop
                  ? { background: 'var(--down-tint)', color: 'var(--down)' }
                  : { background: 'var(--up-tint)', color: 'var(--up)' }}
              >
                {label}
              </span>
            )
          })()}
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

      {/* Level pills — label + price + % merged into the legend */}
      <div className="flex flex-wrap gap-1.5">
        {levels.filter(row => row.rawPrice != null).map((row, i) => {
          const pct = !('isEntry' in row) && row.rawPrice != null && cur != null
            ? pctStr(row.rawPrice, cur) : null
          return (
            <LegendChip
              key={i}
              color={row.color}
              bg={row.tint}
              label={row.label}
              price={row.price}
              pct={pct}
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
