import { IoOpenOutline } from 'react-icons/io5'

import type { TradePlan } from '@/lib/api-types'
import { TradePlanChart } from '@/features/widgets/TradePlanChart'
import { Chip, Panel, PanelEmpty } from './Panel'
import { fmtN } from './portfolio-calc'
import { Clock3 } from 'lucide-react'
import { HintTooltip } from '@/components/ui/hint-tooltip'
import { fmtBarDay, fmtClock } from '@/lib/live-prices'

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
  live = null,
  readAt = null,
  stale = false,
}: {
  plan: TradePlan | null
  /** Every plan, so the select can reach a ticker the table isn't showing. */
  plans: TradePlan[]
  onSelect: (ticker: string) => void
  /** Effective status derived from `/api/ideas`, not the plan's own drifting column. */
  status: string
  /** The sheet's delayed price for this ticker, if it tracks it. */
  live?: number | null
  readAt?: string | null
  stale?: boolean
}) {
  if (!plan) {
    return (
      <Panel side="b" title="Trade planı" padded={false}>
        <PanelEmpty>Gösterilecek plan yok.</PanelEmpty>
      </Panel>
    )
  }

  // The live price when the sheet has one; the content round's price otherwise.
  // Level distances are measured from the same number the reader sees.
  const cur = live ?? plan.currentPrice
  const terminal = TERMINAL_LABEL[status]

  const levels = planLevels(plan)

  return (
    <TradePlanPanelInner
      {...{ plan, plans, onSelect, status, levels, cur, terminal }}
      hint={<PriceHint plan={plan} live={live} readAt={readAt} stale={stale} />}
    />
  )
}

/** The level set the chart draws and the phone ladder lists — one definition. */
function planLevels(plan: TradePlan) {
  return [
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
}



/** The chart's last bar — the content round's close, not the live price. */
function lastBarDay(plan: TradePlan): string | null {
  const bars = plan.priceHistory ?? []
  if (!bars.length) return null
  return [...bars].map((b) => b.t).sort().at(-1) ?? null
}

/**
 * What the price next to a clock icon is, in words. Two prices live on this
 * screen and they are not the same number: the sheet's ~15-minute-delayed live
 * price, and the chart's last bar (written by the content round). When the
 * sheet has no price for this ticker, the panel falls back to the latter and
 * says so rather than passing it off as live.
 */
function PriceHint({
  plan,
  live,
  readAt,
  stale,
}: {
  plan: TradePlan
  live: number | null
  readAt: string | null
  stale: boolean
}) {
  const bar = lastBarDay(plan)
  return (
    <HintTooltip
      align="start"
      label="Bu fiyat nereden geliyor?"
      icon={<Clock3 className="size-[15px]" style={{ color: 'var(--down)' }} aria-hidden="true" />}
    >
      {live != null ? (
        <>
          <p className="text-ink m-0 font-semibold">Son fiyat · ~15 dk gecikmeli</p>
          <p className="text-mid mt-1 mb-0">
            {stale
              ? `Kaynak şu an yanıt vermiyor; bu, ${fmtClock(readAt)}'de okunan son fiyat.`
              : `${fmtClock(readAt)}'de okundu.`}
          </p>
        </>
      ) : (
        <>
          <p className="text-ink m-0 font-semibold">Canlı fiyat yok</p>
          <p className="text-mid mt-1 mb-0">
            Bu sembol fiyat kaynağında izlenmiyor; gösterilen, içerik turunda yazılan fiyat.
          </p>
        </>
      )}
      {bar && (
        <p className="text-mid mt-2 mb-0">
          Grafikteki son bar <span className="text-ink">{fmtBarDay(bar)}</span> tarihli — içerik
          turunda çekildi, canlı değil.
        </p>
      )}
    </HintTooltip>
  )
}

/** "20 Eyl 12:19" — when the content round last wrote this plan's price. */
function writtenAt(stamp: string | null | undefined): string {
  if (!stamp) return 'yazılma zamanı yok'
  const d = new Date(stamp)
  if (Number.isNaN(d.getTime())) return 'yazılma zamanı yok'
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Phone: the plan without a chart.
 *
 * At 375px the chart's plot came to 228px and the price scale ate the rest, so
 * the bars were unreadable — and the one question the chart answered here is
 * "where is the price between the stop and the target". A ladder answers that
 * in words: levels in price order, the current price marked in its place among
 * them, each with its distance. Then the two things that actually decide what
 * to do — the thesis and what breaks it — instead of a picture of past bars.
 */
export function PlanLadder({
  plan,
  status,
  live = null,
  readAt = null,
  stale = false,
}: {
  plan: TradePlan
  status: string
  live?: number | null
  readAt?: string | null
  stale?: boolean
}) {
  // Live (sheet, ~15 min delayed) when there is one; the content round's price
  // otherwise. The row says which, so a fallback is never read as live.
  const cur = live ?? plan.currentPrice
  const rows = planLevels(plan)
    .filter((l) => l.raw != null)
    .sort((a, b) => (b.raw as number) - (a.raw as number))

  // The current price sits in the ladder, not above it: its position between
  // the levels is the reading.
  const above = cur == null ? rows : rows.filter((l) => (l.raw as number) > cur)
  const below = cur == null ? [] : rows.filter((l) => (l.raw as number) <= cur)

  const row = (l: (typeof rows)[number]) => {
    const pct =
      cur != null && cur !== 0 && l.raw != null ? ((l.raw as number) / cur - 1) * 100 : null
    return (
      <div key={l.label} className="border-faint2 flex items-center gap-2.5 border-b py-2.5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: l.color }} />
        <span className="flex-1 text-[13px]">{l.label}</span>
        <span className="num text-[13px] font-medium">{l.price}</span>
        <span className="num text-mid w-[54px] text-right text-[12px]">
          {pct == null ? '' : `${pct > 0 ? '+' : ''}${fmtN(pct, 1)}%`}
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        {above.map(row)}
        {cur != null && (
          <div
            // The tint bleeds 10px past the content on both sides (-mx + px):
            // padded normally, the row's own price sat 10px left of every other
            // price in the ladder and the column stopped reading as a column.
            className="-mx-2.5 my-1 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5"
            style={{ background: 'var(--info-tint)', color: 'var(--info)' }}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: 'var(--info)' }} />
            {/* Not "Şu an": this number is whatever the last content round
                wrote — normally the last session's close — and among levels it
                read as a live quote. The stamp beside it says how old it is. */}
            <span className="flex-1 text-[13px] font-medium">Son fiyat</span>
            {live != null ? (
              // Clock + read time for the sheet's delayed price; the icon opens
              // the same explanation the desktop panel carries.
              <span className="num flex items-center gap-1 text-[11px] whitespace-nowrap">
                <PriceHint plan={plan} live={live} readAt={readAt} stale={stale} />
                <span className="opacity-70">{fmtClock(readAt)}</span>
              </span>
            ) : (
              <span className="num text-[11px] whitespace-nowrap opacity-70">
                {writtenAt(plan.updatedAt)}
              </span>
            )}
            <span className="num text-[13px] font-semibold">{fmtN(cur, 2)}</span>
            <span className="w-[54px]" />
          </div>
        )}
        {below.map(row)}
      </div>

      {plan.thesis && (
        <div className="border-faint mb-3 rounded-[9px] border p-[13px]">
          <div className="text-mid mb-1.5 text-[12px]">Tez</div>
          <p className="m-0 text-[13px] leading-[1.75]">{plan.thesis}</p>
        </div>
      )}

      {plan.invalidation && (
        // Warn tint, like the panel's other "there is something to do here"
        // marks: this text says what ends the idea.
        <div className="rounded-[9px] p-[13px]" style={{ background: 'var(--warn-tint)' }}>
          <div className="mb-1.5 text-[12px]" style={{ color: 'var(--warn)' }}>
            Tezi bozan
          </div>
          <p className="m-0 text-[13px] leading-[1.75]">{plan.invalidation}</p>
        </div>
      )}

      {!plan.thesis && !plan.invalidation && (
        <p className="text-mid text-[13px]">Bu plan için yazılı bir tez yok.</p>
      )}

      {status && TERMINAL_LABEL[status] && (
        <p className="text-mid mt-3 text-[12px]">
          Bu fikir {TERMINAL_LABEL[status]} ile kapandı; seviyeler kapanış anındaki haliyle duruyor.
        </p>
      )}
    </>
  )
}

function TradePlanPanelInner({
  plan,
  plans,
  onSelect,
  status,
  levels,
  cur,
  terminal,
  hint,
}: {
  plan: TradePlan
  plans: TradePlan[]
  onSelect: (ticker: string) => void
  status: string
  levels: ReturnType<typeof planLevels>
  cur: number | null
  terminal: string | undefined
  hint: React.ReactNode
}) {
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
          <div className="mb-3 flex items-center gap-2">
            <span className="num text-[23px] font-medium tracking-[-0.7px]">{fmtN(cur, 2)}</span>
            {hint}
          </div>
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
