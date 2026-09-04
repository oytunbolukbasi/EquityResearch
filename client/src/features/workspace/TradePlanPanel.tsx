import { IoOpenOutline } from 'react-icons/io5'

import type { TradePlan } from '@/lib/api-types'
import { TradePlanChart } from '@/features/widgets/TradePlanChart'
import { Chip, Panel, PanelEmpty } from './Panel'
import { fmtN } from './portfolio-calc'

// TradingView's exchange codes don't always match ours 1:1 (our "XETRA" vs
// their "XETR") — map the ones that differ, pass the rest through.
const TV_EXCHANGE_MAP: Record<string, string> = {
  BIST: 'BIST',
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  XETRA: 'XETR',
  XETR: 'XETR',
}

function tvChartUrl(ticker: string, exchange: string | null): string {
  const tv = exchange ? (TV_EXCHANGE_MAP[exchange.toUpperCase()] ?? exchange) : ''
  return `https://tr.tradingview.com/chart/?symbol=${encodeURIComponent(tv ? `${tv}:${ticker}` : ticker)}`
}

function pctStr(price: number, current: number): string {
  const p = ((price - current) / current) * 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
}

const TERMINAL_LABEL: Record<string, string> = {
  stopped: 'SL',
  tp1_hit: 'TP1',
  tp2_hit: 'TP2',
  tp3_hit: 'TP3',
}

function LevelPill({
  color,
  bg,
  label,
  price,
  pct,
}: {
  color: string
  bg: string
  label: string
  price: string
  pct: string | null
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

export function TradePlanPanel({
  plan,
  plans,
  onSelect,
  status,
}: {
  plan: TradePlan | null
  /** Every plan, so the select can reach a ticker the table isn't showing. */
  plans: TradePlan[]
  onSelect: (ticker: string) => void
  /** Effective status derived from `/api/ideas`, not the plan's own drifting column. */
  status: string
}) {
  if (!plan) {
    return (
      <Panel side="b" title="Trade planı" padded={false}>
        <PanelEmpty>Gösterilecek plan yok.</PanelEmpty>
      </Panel>
    )
  }

  const cur = plan.currentPrice
  const terminal = TERMINAL_LABEL[status]

  const levels = [
    {
      label: 'Giriş Bandı',
      price:
        plan.entryLow != null && plan.entryHigh != null
          ? `${fmtN(plan.entryLow, 2)} – ${fmtN(plan.entryHigh, 2)}`
          : plan.entryLow != null
            ? fmtN(plan.entryLow, 2)
            : '—',
      raw:
        plan.entryLow != null && plan.entryHigh != null
          ? (plan.entryLow + plan.entryHigh) / 2
          : plan.entryLow,
      color: 'var(--info)',
      tint: 'var(--info-tint)',
      isEntry: true,
    },
    { label: 'TP1', price: fmtN(plan.tp1, 2), raw: plan.tp1, color: 'var(--tp1)', tint: 'var(--tp1-tint)', isEntry: false },
    { label: 'TP2', price: fmtN(plan.tp2, 2), raw: plan.tp2, color: 'var(--tp2)', tint: 'var(--tp2-tint)', isEntry: false },
    { label: 'TP3', price: fmtN(plan.tp3, 2), raw: plan.tp3, color: 'var(--tp3)', tint: 'var(--tp3-tint)', isEntry: false },
    { label: 'Hard SL', price: fmtN(plan.hardSl, 2), raw: plan.hardSl, color: 'var(--down)', tint: 'var(--down-tint)', isEntry: false },
  ]

  const header = (
    <div className="flex items-center gap-2.5">
      <span>{plan.ticker}</span>
      {plan.exchange && <Chip>{plan.exchange}</Chip>}
      <a
        href={tvChartUrl(plan.ticker, plan.exchange)}
        target="_blank"
        rel="noopener noreferrer"
        title="TradingView'da aç"
        className="text-mid hover:text-ink -m-1 flex items-center p-1 transition-colors"
      >
        <IoOpenOutline size={14} />
      </a>
      {terminal && (
        <span
          className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={
            status === 'stopped'
              ? { background: 'var(--down-tint)', color: 'var(--down)' }
              : { background: 'var(--up-tint)', color: 'var(--up)' }
          }
        >
          {terminal}
        </span>
      )}
    </div>
  )

  return (
    <Panel
      side="b"
      title={header}
      right={
        plans.length > 1 ? (
          <select
            value={plan.ticker}
            onChange={(e) => onSelect(e.target.value)}
            aria-label="Trade planı seç"
            className="num border-faint bg-card text-ink rounded-[7px] border px-2 py-1 text-xs"
          >
            {plans.map((p) => (
              <option key={p.ticker} value={p.ticker}>
                {p.ticker}
              </option>
            ))}
          </select>
        ) : undefined
      }
      padded={false}
    >
      <div className="px-[18px] pb-[18px]">
        {cur != null && (
          <div className="num mb-3 text-[23px] font-medium tracking-[-0.7px]">{fmtN(cur, 2)}</div>
        )}

        <TradePlanChart plan={plan} />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {levels
            .filter((l) => l.raw != null)
            .map((l) => (
              <LevelPill
                key={l.label}
                color={l.color}
                bg={l.tint}
                label={l.label}
                price={l.price}
                pct={!l.isEntry && l.raw != null && cur != null ? pctStr(l.raw, cur) : null}
              />
            ))}
        </div>

        {(plan.thesis || plan.invalidation) && (
          <div className="border-faint text-mid mt-3 space-y-1.5 border-t pt-3 text-xs leading-relaxed">
            {plan.thesis && (
              <p>
                <span className="text-ink font-medium">Tez:</span> {plan.thesis}
              </p>
            )}
            {plan.invalidation && (
              <p>
                <span className="text-ink font-medium">Tezi bozan:</span> {plan.invalidation}
              </p>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}
