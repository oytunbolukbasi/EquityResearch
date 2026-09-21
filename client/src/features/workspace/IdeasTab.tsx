import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { endAlignedLeft } from '@/lib/anchor'
import { IoInformationCircleOutline } from 'react-icons/io5'

import type { Idea, TradePlan } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { useLivePrices, fmtClock } from '@/lib/live-prices'
import { HintTooltip } from '@/components/ui/hint-tooltip'
import { Clock3 } from 'lucide-react'
import { useMediaQuery } from '@/lib/use-media-query'
import { RiskRewardBar, RiskRewardStrip } from '@/components/ui/risk-reward-bar'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane, PHONE_QUERY } from './split'
import { Notice, UnderlineTabs } from './shared'
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton'
import { TradePlanPanel, PlanLadder } from './TradePlanPanel'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { fmtN } from './portfolio-calc'

/** Statuses that retire an idea to the Geçmiş tab. */
const HISTORY_STATUSES = new Set(['stopped', 'tp1_hit', 'tp2_hit', 'tp3_hit'])

type IdeaTab = 'active' | 'history'

const IDEA_TABS = [
  { id: 'active' as const, label: 'Aktif' },
  { id: 'history' as const, label: 'Geçmiş' },
]

/**
 * "9 Eyl" for this year, "9 Eyl 2025" otherwise. The year on every row of a
 * table that is almost entirely this year's ideas cost ~35px per date column —
 * the width that pushed the table into a sideways scroll at a half-width panel.
 */
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    ...(y === new Date().getFullYear() ? {} : { year: 'numeric' }),
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
  const [pos, setPos] = useState({ top: 0, left: 0 })
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
            setPos({ top: r.bottom + 4, left: endAlignedLeft(r, 280) })
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
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 280 }}
            className="border-faint bg-card rounded-lg border p-3 shadow-lg"
          >
            <p className="text-ink mb-1 text-xs font-semibold">Risk / getiri</p>
            <p className="text-mid text-[12px] leading-relaxed">
              Çubuk soldan sağa stoptan TP1'e uzanır ve girişte (siyah çizgi) ikiye bölünür:
              <span style={{ color: 'var(--down)' }}> kırmızı</span> girişten stopa olan mesafe
              (risk), <span style={{ color: 'var(--up)' }}>yeşil</span> girişten TP1'e olan
              mesafe (getiri). Üstteki sayı yeşilin kırmızının kaç katı olduğu.
            </p>
            <p className="text-mid mt-1.5 text-[12px] leading-relaxed">
              <span style={{ color: 'var(--info)' }}>Mavi halka</span> son fiyat (~15 dk
              gecikmeli): kırmızıdaysa fiyat girişin altında, sağ uca yaklaştıkça TP1'e yakın.
            </p>
            <p className="text-mid mt-1.5 text-[12px] leading-relaxed">
              Giriş için bant ortası kullanılır. Örnek: giriş 100, stop 90, TP1 130 → 3,0×
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
  const phone = useMediaQuery(PHONE_QUERY)
  const [sheetOpen, setSheetOpen] = useState(false)

  /**
   * Phone: picking an idea opens its plan in a sheet.
   *
   * Not inline below the list: the plan sits under every row, so reading one
   * meant scrolling down and back up for the next — the user's words, "aşağı
   * yukarı gezinmek mobil için iyi bir deneyim değil". The sheet keeps the list
   * in place behind it, same as the portfolio row's note.
   */
  function chooseIdea(t: string) {
    setTicker(t)
    if (phone) setSheetOpen(true)
  }

  const { data: ideas, loading, error } = useApi<Idea[]>('/api/ideas')
  const { data: plans } = useApi<TradePlan[]>('/api/trade-plans')
  const { data: live } = useLivePrices()
  const liveOf = (t: string | undefined) => (t ? live?.prices[t] ?? null : null)

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

  if (error) return <Notice>Fikir verisi alınamadı.</Notice>

  const isHistory = tab === 'history'

  const ideasPanel = (
    <Panel
      side="a"
      title="Fikirler"
      belowHeader={<UnderlineTabs items={IDEA_TABS} value={tab} onChange={setTab} />}
      padded={false}
      maxBodyHeight={phone ? undefined : '72vh'}
    >
      {loading ? (
        <SkeletonRows rows={6} cols={phone ? 2 : 4} className="border-faint2 border-t" />
      ) : !visibleIdeas.length ? (
        <PanelEmpty>
          {tab === 'active'
            ? 'Aktif fikir yok.'
            : 'Geçmiş kayıt yok. Stop veya hedefe ulaşan fikirler burada listelenir.'}
        </PanelEmpty>
      ) : phone ? (
        /*
          Phone: cards, not a table. The eight columns measured 581px against a
          325px screen, so Risk/Getiri, the dates and Durum sat behind a
          horizontal scroll — and the first two are the reason to read the row.
        */
        <div className="border-faint2 flex flex-col border-t">
          {visibleIdeas.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => chooseIdea(idea.ticker)}
              data-selected={plan?.ticker === idea.ticker}
              className="eqr-row border-faint2 flex w-full cursor-pointer flex-col gap-2 border-b px-[18px] py-3 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">{idea.ticker}</span>
                {idea.exchange && <span className="num text-mid text-[12px]">{idea.exchange}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <DirectionBadge direction={idea.direction} />
                  {isHistory && <StatusBadge status={idea.status} />}
                </span>
              </span>
              <span className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className="text-mid">
                  Giriş{' '}
                  <span className="text-ink">
                    {idea.entryLow != null && idea.entryHigh != null
                      ? `${fmtN(idea.entryLow, 0)}–${fmtN(idea.entryHigh, 0)}`
                      : fmtN(idea.entryLow, 0)}
                  </span>
                </span>
                <span style={{ color: 'var(--down)' }}>SL {fmtN(idea.stopLoss, 0)}</span>
                <span style={{ color: 'var(--up)' }}>TP1 {fmtN(idea.target1, 0)}</span>
                <span className="text-mid ml-auto">{fmtDate(idea.firstDate)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${TH} pr-3 pl-[18px]`}>Hisse</th>
                <th className={`${TH} px-2 text-right`}>
                  <span className="inline-flex items-center justify-end gap-1">
                    Son fiyat
                    <HintTooltip
                      label="Son fiyat ne zaman okundu?"
                      icon={<Clock3 className="size-[13px]" style={{ color: 'var(--down)' }} aria-hidden="true" />}
                      width={260}
                    >
                      <p className="text-ink m-0 font-semibold">~15 dk gecikmeli fiyat</p>
                      <p className="text-mid mt-1 mb-0 normal-case">
                        {live?.readAt
                          ? live.stale
                            ? `Kaynak şu an yanıt vermiyor; ${fmtClock(live.readAt)}'de okunan son fiyatlar.`
                            : `${fmtClock(live.readAt)}'de okundu.`
                          : 'Fiyat kaynağına şu an ulaşılamıyor.'}
                      </p>
                      <p className="text-mid mt-1.5 mb-0 normal-case">
                        Portföyle aynı kaynaktan gelir. Kaynakta izlenmeyen sembollerde boş kalır.
                      </p>
                    </HintTooltip>
                  </span>
                </th>
                <th className={`${TH} px-2 text-right`}>Giriş</th>
                <th className={`${TH} px-2 text-right`}>SL</th>
                <th className={`${TH} px-2 text-right`}>TP1</th>
                <th className={`${TH} px-2 text-right`}>
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Risk/Getiri
                    <RiskRewardTooltip />
                  </span>
                </th>
                <th className={`${TH} px-2 text-right`}>Öneri tarihi</th>
                {isHistory && <th className={`${TH} px-2 text-right`}>Bitiş tarihi</th>}
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
                    {/* Direction rides beside the ticker, not in its own column:
                        a 60px column holding one word ("LONG") on every row was
                        what pushed the table into a sideways scroll once the
                        Son fiyat column arrived. Beside the ticker, not beside
                        the exchange — "NASDAQ LONG" made the cell wider still. */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold">{idea.ticker}</span>
                      <DirectionBadge direction={idea.direction} />
                    </div>
                    {idea.exchange && <div className="num text-mid text-[12px]">{idea.exchange}</div>}
                  </td>
                  <td className="num px-2 text-right whitespace-nowrap">
                    {liveOf(idea.ticker) != null ? (
                      fmtN(liveOf(idea.ticker), 2)
                    ) : (
                      <span className="text-mid">—</span>
                    )}
                  </td>
                  <td className="num px-2 text-right whitespace-nowrap">
                    {idea.entryLow != null && idea.entryHigh != null
                      ? `${fmtN(idea.entryLow, 0)}–${fmtN(idea.entryHigh, 0)}`
                      : fmtN(idea.entryLow, 0)}
                  </td>
                  <td
                    className="num px-2 text-right whitespace-nowrap"
                    style={{ color: 'var(--down)' }}
                  >
                    {fmtN(idea.stopLoss, 0)}
                  </td>
                  <td
                    className="num px-2 text-right whitespace-nowrap"
                    style={{ color: 'var(--up)' }}
                  >
                    {fmtN(idea.target1, 0)}
                  </td>
                  <td className="px-2">
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
                          // Only for open ideas: a closed idea's live price
                          // plotted against its old levels answers nothing.
                          currentPrice={isHistory ? null : liveOf(idea.ticker)}
                        />
                      ) : (
                        <span className="num text-mid text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="num text-mid px-2 text-right whitespace-nowrap">
                    {fmtDate(idea.firstDate)}
                  </td>
                  {isHistory && (
                    <td className="num text-mid px-2 text-right whitespace-nowrap">
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
        subtitle={phone ? 'Fikri seç, planı altta incele.' : 'Fikri seç, planı sağda incele.'}
        // Not "0 plan" while the list is on its way — a count is a fact, and
        // we don't have it yet.
        right={loading ? undefined : <Chip>{allPlans.length} plan</Chip>}
      />
      {/* The chart is desktop-only: at 375px its plot fell to 228px and the
          bars stopped being readable. On a phone the sheet carries the same
          plan as a level ladder plus the thesis. */}
      {phone ? (
        <>
          {ideasPanel}
          {plan && (
            <BottomSheet
              open={sheetOpen}
              title={
                <span className="flex items-baseline gap-2">
                  {plan.ticker}
                  {plan.exchange && (
                    <span className="text-mid num text-[12px] font-normal">{plan.exchange}</span>
                  )}
                </span>
              }
              onClose={() => setSheetOpen(false)}
            >
              {plan.hardSl != null &&
                plan.entryLow != null &&
                plan.entryHigh != null &&
                plan.tp1 != null && (
                  <RiskRewardStrip
                    className="mb-3"
                    stopLoss={plan.hardSl}
                    entryLow={plan.entryLow}
                    entryHigh={plan.entryHigh}
                    target1={plan.tp1}
                    direction={plan.tp1 < plan.hardSl ? 'short' : 'long'}
                    // Same rule as the table: a closed idea's price against its
                    // old levels answers nothing.
                    currentPrice={
                      HISTORY_STATUSES.has(effStatus(plan)) ? null : liveOf(plan.ticker)
                    }
                  />
                )}
              <PlanLadder
                plan={plan}
                status={effStatus(plan)}
                live={liveOf(plan.ticker)}
                readAt={live?.readAt ?? null}
                stale={live?.stale ?? false}
              />
            </BottomSheet>
          )}
        </>
      ) : (
        <SplitPane
          splitKey="ideas"
          a={ideasPanel}
          b={
            loading ? (
              <section className="eqr-panel bg-card border-faint flex flex-col gap-4 rounded-xl border px-[18px] py-4">
                <Skeleton h={14} w="28%" />
                <Skeleton h={22} w="40%" />
                <Skeleton h={190} radius={10} />
                <span className="flex gap-2">
                  <Skeleton h={18} w={92} radius={9} />
                  <Skeleton h={18} w={78} radius={9} />
                  <Skeleton h={18} w={84} radius={9} />
                </span>
              </section>
            ) : (
            <TradePlanPanel
              plan={plan}
              plans={allPlans}
              onSelect={chooseIdea}
              status={plan ? effStatus(plan) : 'active'}
              live={liveOf(plan?.ticker)}
              readAt={live?.readAt ?? null}
              stale={live?.stale ?? false}
            />
            )
          }
        />
      )}
    </div>
  )
}
