import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoInformationCircleOutline } from 'react-icons/io5'

import type { Idea, TradePlan } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { RiskRewardBar } from '@/components/ui/risk-reward-bar'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane } from './split'
import { Loading, Notice, UnderlineTabs } from './shared'
import { TradePlanPanel } from './TradePlanPanel'
import { fmtN } from './portfolio-calc'

/** Statuses that retire an idea to the Geçmiş tab. */
const HISTORY_STATUSES = new Set(['stopped', 'tp1_hit', 'tp2_hit', 'tp3_hit'])

type IdeaTab = 'active' | 'history'

const IDEA_TABS = [
  { id: 'active' as const, label: 'Aktif' },
  { id: 'history' as const, label: 'Geçmiş' },
]

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (direction !== 'long' && direction !== 'short')
    return <span className="text-mid text-xs">—</span>
  const up = direction === 'long'
  return (
    <span
      className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        background: up ? 'var(--up-tint)' : 'var(--down-tint)',
        color: up ? 'var(--up)' : 'var(--down)',
      }}
    >
      {up ? 'LONG' : 'SHORT'}
    </span>
  )
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Aktif', bg: 'var(--info-tint)', color: 'var(--info)' },
  review: { label: 'İncele', bg: 'var(--warn-tint)', color: 'var(--warn)' },
  watch: { label: 'İzle', bg: 'var(--warn-tint)', color: 'var(--warn)' },
  hit_target: { label: 'Hedef', bg: 'var(--up-tint)', color: 'var(--up)' },
  tp1_hit: { label: 'TP1', bg: 'var(--up-tint)', color: 'var(--up)' },
  tp2_hit: { label: 'TP2', bg: 'var(--up-tint)', color: 'var(--up)' },
  tp3_hit: { label: 'TP3', bg: 'var(--up-tint)', color: 'var(--up)' },
  stopped: { label: 'SL', bg: 'var(--down-tint)', color: 'var(--down)' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLE[status] ?? {
    label: status,
    bg: 'var(--neutral-tint)',
    color: 'var(--mid)',
  }
  return (
    <span
      className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

/**
 * Portalled so the panel's `overflow: auto` can't clip it. Positioned against
 * the trigger's viewport rect, which is why it uses `position: fixed`.
 */
function RiskRewardTooltip() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (!tipRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect()
            setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
          }
          setOpen((v) => !v)
        }}
        className="text-mid hover:text-ink ml-0.5 align-middle transition-colors"
        style={{ lineHeight: 0 }}
        aria-label="Risk/getiri oranı nasıl hesaplanır?"
      >
        <IoInformationCircleOutline size={13} />
      </button>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, width: 280 }}
            className="border-faint bg-card rounded-lg border p-3 shadow-lg"
          >
            <p className="text-ink mb-1 text-xs font-semibold">Risk/Getiri Oranı</p>
            <p className="text-mid text-[11px] leading-relaxed">
              Potansiyel kazancın potansiyel kayba oranı:
            </p>
            <p className="num text-ink mt-1 text-[11px] font-medium">
              (TP1 − Giriş) ÷ (Giriş − Stop)
            </p>
            <p className="text-mid mt-1.5 text-[11px] leading-relaxed">
              Giriş için bant ortalaması (Low + High) / 2 kullanılır. Örnek: Giriş 100, Stop 90, TP1
              130 → R/R = 3,0×
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}

const TH =
  'bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 text-left font-medium whitespace-nowrap'

export function IdeasTab() {
  const [tab, setTab] = useState<IdeaTab>('active')
  const [ticker, setTicker] = useState<string | null>(null)

  const { data: ideas, loading, error } = useApi<Idea[]>('/api/ideas')
  const { data: plans } = useApi<TradePlan[]>('/api/trade-plans')

  // Ideas are the source of truth for a ticker's status — a trade_plan's own
  // `status` column drifts, because currentPrice updates keep bumping updatedAt
  // while status stays 'active' long after the idea went terminal.
  const ideaByTicker = new Map((ideas ?? []).map((i) => [i.ticker.toUpperCase(), i]))
  const effStatus = (p: TradePlan) => ideaByTicker.get(p.ticker.toUpperCase())?.status ?? p.status

  const visibleIdeas = (ideas ?? []).filter((i) =>
    tab === 'active' ? !HISTORY_STATUSES.has(i.status) : HISTORY_STATUSES.has(i.status),
  )

  const allPlans = plans ?? []

  // Default selection: the plan of the newest non-terminal idea (/api/ideas is
  // already date DESC), falling back to whatever plan exists at all.
  function pickPlan(): TradePlan | null {
    if (!allPlans.length) return null
    if (ticker) {
      const chosen = allPlans.find((p) => p.ticker === ticker)
      if (chosen) return chosen
    }
    for (const idea of ideas ?? []) {
      if (HISTORY_STATUSES.has(idea.status)) continue
      const p = allPlans.find((v) => v.ticker.toUpperCase() === idea.ticker.toUpperCase())
      if (p) return p
    }
    return allPlans[0]
  }
  const plan = pickPlan()

  if (loading) return <Loading />
  if (error) return <Notice>Fikir verisi alınamadı.</Notice>

  const isHistory = tab === 'history'

  const ideasPanel = (
    <Panel
      side="a"
      title="Fikirler"
      belowHeader={<UnderlineTabs items={IDEA_TABS} value={tab} onChange={setTab} />}
      padded={false}
      maxBodyHeight="72vh"
    >
      {!visibleIdeas.length ? (
        <PanelEmpty>
          {tab === 'active'
            ? 'Aktif fikir yok.'
            : 'Geçmiş kayıt yok. Stop veya hedefe ulaşan fikirler burada listelenir.'}
        </PanelEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${TH} pr-3 pl-[18px]`}>Hisse</th>
                <th className={`${TH} px-2.5`}>Yön</th>
                <th className={`${TH} px-2.5 text-right`}>Giriş</th>
                <th className={`${TH} px-2.5 text-right`}>SL</th>
                <th className={`${TH} px-2.5 text-right`}>TP1</th>
                <th className={`${TH} px-2.5 text-right`}>
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Risk/Getiri
                    <RiskRewardTooltip />
                  </span>
                </th>
                <th className={`${TH} px-2.5 text-right`}>Öneri tarihi</th>
                {isHistory && <th className={`${TH} px-2.5 text-right`}>Bitiş tarihi</th>}
                <th className={`${TH} pr-[18px] pl-2.5`}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {visibleIdeas.map((idea) => (
                <tr
                  key={idea.id}
                  onClick={() => setTicker(idea.ticker)}
                  className="border-faint2 hover:bg-bg cursor-pointer border-b"
                  style={{
                    background: plan?.ticker === idea.ticker ? 'var(--bg)' : 'transparent',
                  }}
                >
                  <td className="pr-3 pl-[18px]">
                    <div className="text-[13px] font-semibold">{idea.ticker}</div>
                    {idea.exchange && <div className="num text-mid text-[11px]">{idea.exchange}</div>}
                  </td>
                  <td className="px-2.5">
                    <DirectionBadge direction={idea.direction} />
                  </td>
                  <td className="num px-2.5 text-right whitespace-nowrap">
                    {idea.entryLow != null && idea.entryHigh != null
                      ? `${fmtN(idea.entryLow, 0)}–${fmtN(idea.entryHigh, 0)}`
                      : fmtN(idea.entryLow, 0)}
                  </td>
                  <td
                    className="num px-2.5 text-right whitespace-nowrap"
                    style={{ color: 'var(--down)' }}
                  >
                    {fmtN(idea.stopLoss, 0)}
                  </td>
                  <td
                    className="num px-2.5 text-right whitespace-nowrap"
                    style={{ color: 'var(--up)' }}
                  >
                    {fmtN(idea.target1, 0)}
                  </td>
                  <td className="px-2.5">
                    <div className="flex justify-end">
                      {idea.stopLoss != null &&
                      idea.entryLow != null &&
                      idea.entryHigh != null &&
                      idea.target1 != null ? (
                        <RiskRewardBar
                          stopLoss={idea.stopLoss}
                          entryLow={idea.entryLow}
                          entryHigh={idea.entryHigh}
                          target1={idea.target1}
                          direction={idea.direction}
                        />
                      ) : (
                        <span className="num text-mid text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="num text-mid px-2.5 text-right whitespace-nowrap">
                    {fmtDate(idea.firstDate)}
                  </td>
                  {isHistory && (
                    <td className="num text-mid px-2.5 text-right whitespace-nowrap">
                      {fmtDate(idea.endDate)}
                    </td>
                  )}
                  <td className="pr-[18px] pl-2.5">
                    <StatusBadge status={idea.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )

  return (
    <div>
      <TabHeading
        title="Pozisyon Fikirleri"
        subtitle="Fikri seç, planı sağda incele."
        right={<Chip>{allPlans.length} plan</Chip>}
      />
      <SplitPane
        splitKey="ideas"
        a={ideasPanel}
        b={
          <TradePlanPanel
            plan={plan}
            plans={allPlans}
            onSelect={setTicker}
            status={plan ? effStatus(plan) : 'active'}
          />
        }
      />
    </div>
  )
}
