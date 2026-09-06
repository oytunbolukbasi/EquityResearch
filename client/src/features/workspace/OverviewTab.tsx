import { useState } from 'react'

import type {
  PortfolioAction,
  PortfolioClosedPosition,
  PortfolioInsight,
  PortfolioPosition,
  PortfolioSummary,
  MorningNote,
} from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane } from './split'
import { ScrollRail } from '@/components/ui/scroll-rail'
import { ActionBadge, Loading, Notice, PillTabs } from './shared'
import {
  fmtMoney,
  fmtN,
  fmtPct,
  fmtQty,
  fmtSignedMoney,
  plColor,
  UNIT_FOR_TYPE,
} from './portfolio-calc'
import { computeAnalytics, type Bucket } from './analytics-calc'
import { fmtNoteDate, noteSections, readMinutes } from './note-sections'

type PortSub = 'notes' | 'analysis' | 'history'

const PORT_SUBS = [
  { id: 'notes' as const, label: 'Hisse notları' },
  { id: 'analysis' as const, label: 'Günlük analiz' },
  { id: 'history' as const, label: 'Geçmiş' },
]

// ─── KPI cards ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  hint,
  bucket,
  footer,
}: {
  label: string
  hint: string
  bucket: Bucket
  footer: string
}) {
  return (
    <article className="bg-card border-faint rounded-xl border px-[18px] py-4">
      <div className="text-mid flex justify-between gap-2 text-[12px]">
        <span>{label}</span>
        <span>{hint}</span>
      </div>
      <div className="num my-2 text-[26px] font-medium tracking-[-1px]">
        {fmtMoney(bucket.value, '₺', 0)}
      </div>
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="num" style={{ color: plColor(bucket.pl) }}>
          {fmtSignedMoney(bucket.pl, '₺')} · {fmtPct(bucket.plPercent)}
        </span>
        <span className="text-mid num shrink-0">{footer}</span>
      </div>
    </article>
  )
}

// ─── portfolio panel ─────────────────────────────────────────────────────────

function PositionsTable({
  positions,
  actions,
  selected,
  onSelect,
}: {
  positions: PortfolioPosition[]
  actions: Map<string, PortfolioAction>
  selected: string | null
  onSelect: (symbol: string) => void
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 pr-3 pl-[18px] text-left font-medium">
            Varlık
          </th>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b px-3 py-2 text-right font-medium whitespace-nowrap">
            Son fiyat
          </th>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b px-3 py-2 text-right font-medium whitespace-nowrap">
            K/Z %
          </th>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 pr-[18px] pl-3 text-left font-medium">
            Not
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const action = actions.get(p.symbol)
          const unit = UNIT_FOR_TYPE[p.type] ?? ''
          return (
            <tr
              key={p.id}
              onClick={() => onSelect(p.symbol)}
              className="border-faint2 hover:bg-bg cursor-pointer border-b"
              style={{ background: selected === p.symbol ? 'var(--bg)' : 'transparent' }}
            >
              <td className="pr-3 pl-[18px]">
                <div className="text-[13px] font-semibold">{p.symbol}</div>
                {p.name && <div className="text-mid text-[12px]">{p.name}</div>}
              </td>
              <td className="num px-3 text-right whitespace-nowrap">
                {fmtMoney(p.currentPrice, unit)}
              </td>
              <td
                className="num px-3 text-right whitespace-nowrap"
                style={{ color: plColor(p.plPercent) }}
              >
                {fmtPct(p.plPercent)}
              </td>
              <td className="pr-[18px] pl-3">
                {action ? (
                  <ActionBadge action={action.action} />
                ) : (
                  <span className="text-mid text-[12px]">—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ClosedTable({ closed }: { closed: PortfolioClosedPosition[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 pr-3 pl-[18px] text-left font-medium">
            Sembol
          </th>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b px-3 py-2 text-right font-medium whitespace-nowrap">
            Alış
          </th>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b px-3 py-2 text-right font-medium whitespace-nowrap">
            Satış
          </th>
          <th className="bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 pr-[18px] pl-3 text-right font-medium whitespace-nowrap">
            K/Z %
          </th>
        </tr>
      </thead>
      <tbody>
        {closed.map((c, i) => (
          <tr key={`${c.symbol}-${c.sellDate}-${i}`} className="border-faint2 hover:bg-bg border-b">
            <td className="pr-3 pl-[18px]">
              <div className="text-[13px] font-semibold">{c.symbol}</div>
              <div className="num text-mid text-[12px]">{c.sellDate.slice(0, 10)}</div>
            </td>
            <td className="num px-3 text-right whitespace-nowrap">{fmtN(c.buyPrice)}</td>
            <td className="num px-3 text-right whitespace-nowrap">{fmtN(c.sellPrice)}</td>
            <td
              className="num pr-[18px] pl-3 text-right font-medium whitespace-nowrap"
              style={{ color: plColor(c.pl) }}
            >
              {fmtPct(c.plPercent)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── right panel: position detail ────────────────────────────────────────────

function DetailPanel({
  position,
  action,
  noteDate,
  onClose,
}: {
  position: PortfolioPosition
  action: PortfolioAction | undefined
  noteDate: string
  onClose: () => void
}) {
  const unit = UNIT_FOR_TYPE[position.type] ?? ''
  const unitLabel =
    position.type === 'us_stock' ? 'ABD hissesi · USD' : position.type === 'fund' ? 'Fon' : 'BİST · TL'

  return (
    <section className="eqr-panel bg-card border-faint flex h-full flex-col rounded-xl border">
      <header className="flex shrink-0 items-start justify-between gap-2 px-[18px] pt-3.5">
        <div>
          <h2 className="m-0 text-[15px] font-medium tracking-[-0.25px]">{position.symbol}</h2>
          {position.name && <span className="text-mid text-[12px]">{position.name}</span>}
        </div>
        <button
          onClick={onClose}
          aria-label="Detayı kapat"
          className="text-mid hover:text-ink cursor-pointer border-0 bg-transparent p-[3px] text-base leading-none"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-[18px] pt-2 pb-[19px]">
        <Chip>{unitLabel}</Chip>
        <div className="num mt-3.5 mb-3 text-[28px] font-medium tracking-[-1px]">
          {fmtMoney(position.currentPrice, unit)}
        </div>

        <div className="border-faint mb-4 grid grid-cols-2 gap-4 border-t border-b py-4">
          <Metric label="Ortalama maliyet" value={fmtMoney(position.buyPrice, unit)} />
          <Metric
            label="Pozisyon K/Z"
            value={`${fmtPct(position.plPercent)}`}
            color={plColor(position.plPercent)}
          />
          <Metric label="Miktar" value={fmtQty(position.quantity)} />
          <Metric label="Not tarihi" value={action ? noteDate : '—'} />
        </div>

        <h3 className="m-0 mb-2 text-[13px] font-medium">Araştırma notu</h3>
        {action ? (
          <div className="rounded-[9px] p-[13px]" style={{ background: 'var(--warn-tint)' }}>
            <ActionBadge action={action.action} />
            <p className="mt-2.5 mb-0 text-xs leading-[1.8]">{action.reason}</p>
          </div>
        ) : (
          <p className="text-mid text-xs leading-[1.7]">
            Bu varlık için güncel bir araştırma notu yok.
          </p>
        )}
      </div>
    </section>
  )
}

/** The currency each group is priced in — the card's small right-hand note. */
const GROUP_HINT: Record<string, string> = {
  tr: 'BİST + fon',
  us: 'USD',
  de: 'EUR',
  crypto: 'USD',
}

/** Groups priced in a foreign currency show the rate they were converted at. */
function rateFooter(id: string, summary: PortfolioSummary | null): string {
  if (!summary) return 'Maliyete göre'
  if (id === 'us' || id === 'crypto') return `Kur: ${fmtN(summary.rates.USD, 2)}`
  if (id === 'de') return `Kur: ${fmtN(summary.rates.EUR, 2)}`
  return 'Maliyete göre'
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <small className="text-mid mb-1 block text-[12px]">{label}</small>
      <b className="num text-sm font-medium" style={color ? { color } : undefined}>
        {value}
      </b>
    </div>
  )
}

// ─── right panel: pulse brief ────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[12px] font-medium tracking-[0.7px]"
      style={{ color: 'var(--warn)' }}
    >
      {children}
    </span>
  )
}

function PulseBrief({
  note,
  onOpenPulse,
}: {
  note: MorningNote | null
  onOpenPulse: (sectionId?: string) => void
}) {
  const sections = noteSections(note)
  const macro = sections.filter((s) => s.id.startsWith('macro-'))
  const sector = sections.find((s) => s.id === 'sector')

  return (
    <Panel
      side="b"
      title="Piyasa Nabzı"
      right={
        <span className="text-mid shrink-0 text-[12px]">
          {note ? `${readMinutes(note)} dk okuma` : ''}
        </span>
      }
      padded={false}
    >
      {!note ? (
        <PanelEmpty>Henüz bülten eklenmedi.</PanelEmpty>
      ) : (
        <div className="px-[18px] pb-[18px]">
          <Kicker>ANA GÖRÜŞ</Kicker>
          <p className="mt-2.5 mb-[18px] text-sm leading-[1.85]">{note.topCall ?? '—'}</p>

          {macro.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-[13px] font-medium">Makro gündem</h3>
                <span className="text-mid text-[12px]">{macro.length} başlık</span>
              </div>
              <div className="border-faint mt-3 mb-4 border-t">
                {macro.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => onOpenPulse(s.id)}
                    className="border-faint hover:text-info flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b bg-transparent py-3 text-left text-xs leading-[1.65] transition-colors"
                  >
                    <span className="flex-1">{s.label}</span>
                    <span className="text-mid num shrink-0 text-[12px]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {sector && (
            <>
              <Kicker>SEKTÖR ODAĞI</Kicker>
              <p className="mt-[5px] mb-[18px] text-xs leading-[1.7]">{sector.label}</p>
            </>
          )}

          <button
            onClick={() => onOpenPulse()}
            className="inline-flex cursor-pointer items-center gap-[7px] rounded-[7px] px-3.5 py-2 text-xs font-medium transition-opacity hover:opacity-85"
            style={{ background: 'var(--ink)', color: 'var(--card)' }}
          >
            Bültenin tamamını oku →
          </button>
        </div>
      )}
    </Panel>
  )
}

// ─── tab ─────────────────────────────────────────────────────────────────────

export function OverviewTab({ onOpenPulse }: { onOpenPulse: (sectionId?: string) => void }) {
  const [sub, setSub] = useState<PortSub>('notes')
  const [detail, setDetail] = useState<string | null>(null)

  const { data: summary, loading, error } = useApi<PortfolioSummary>('/api/portfolio/summary')
  const { data: closed } = useApi<PortfolioClosedPosition[]>('/api/portfolio/closed')
  const { data: insight } = useApi<PortfolioInsight | null>('/api/portfolio/insight')
  const { data: notes } = useApi<MorningNote[]>('/api/morning-notes/history')

  const positions = summary?.positions ?? []
  const note = notes?.[0] ?? null

  // Genel Bakış ve Analiz aynı hesaptan besleniyor. Ayrı iki uygulama
  // (computeTotals) vardı; aynı etiketin altında farklı rakamlar çıkabildiği
  // için kaldırıldı — tek kaynak kalsın.
  const totals = computeAnalytics(positions, closed ?? [], summary?.rates ?? { TRY: 1, USD: 1, EUR: 1 }, {
    from: null,
    to: null,
  })

  const actions = new Map<string, PortfolioAction>()
  for (const a of insight?.actions ?? []) actions.set(a.ticker, a)

  const detailPosition = detail ? positions.find((p) => p.symbol === detail) : undefined
  // A row whose position vanished between renders (data refresh) closes itself
  // rather than leaving the right panel stuck on a stale ticker.
  const showDetail = detail != null && detailPosition != null

  const portfolioPanel = (
    <Panel
      side="a"
      title="Portföy"
      right={<Chip>{actions.size} araştırma notu</Chip>}
      belowHeader={<PillTabs items={PORT_SUBS} value={sub} onChange={setSub} />}
      padded={false}
      maxBodyHeight="60vh"
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice>Portföy verisi alınamadı.</Notice>
      ) : sub === 'notes' ? (
        positions.length === 0 ? (
          <PanelEmpty>Açık pozisyon yok.</PanelEmpty>
        ) : (
          <div className="border-faint2 border-t">
            <PositionsTable
              positions={positions}
              actions={actions}
              selected={detail}
              onSelect={(s) => setDetail((cur) => (cur === s ? null : s))}
            />
          </div>
        )
      ) : sub === 'analysis' ? (
        <div className="border-faint2 border-t px-[18px] pt-1.5 pb-[18px]">
          <div className="flex items-center justify-between pt-3 pb-2">
            <h3 className="m-0 text-[13px] font-medium">Günlük portföy analizi</h3>
            <span className="text-mid num text-[12px]">{fmtNoteDate(insight?.date)}</span>
          </div>
          {/* pre-line so a multi-paragraph analysis keeps its breaks, matching
              how the bulletin article renders its sections. */}
          <p className="m-0 whitespace-pre-line text-[13px] leading-[1.75]">
            {insight?.body ?? 'Henüz analiz eklenmedi.'}
          </p>
        </div>
      ) : !closed?.length ? (
        <PanelEmpty>Kapatılan pozisyon yok.</PanelEmpty>
      ) : (
        <div className="border-faint2 border-t">
          <ClosedTable closed={closed} />
        </div>
      )}
    </Panel>
  )

  const rightPanel = showDetail ? (
    <DetailPanel
      position={detailPosition}
      action={actions.get(detailPosition.symbol)}
      noteDate={fmtNoteDate(insight?.date)}
      onClose={() => setDetail(null)}
    />
  ) : (
    <PulseBrief note={note} onOpenPulse={onOpenPulse} />
  )

  return (
    <div>
      <TabHeading
        title="Genel bakış"
        subtitle="Portföyün, araştırman ve işlem planların bir arada."
      />

      {/*
        One card per asset group, plus the total — five today and one more
        whenever a group is added, which is why they live on a scrolling rail
        instead of a grid: the last card is deliberately cut off, because a
        clipped card is the only honest way to say "there is more to the right".
      */}
      <ScrollRail className="eqr-kpi-rail mb-5 gap-3 pb-1">
        <KpiCard
          label="Toplam portföy değeri"
          hint="TL bazında"
          bucket={{
            value: totals.totalValue,
            cost: totals.totalCost,
            pl: totals.unrealized,
            plPercent: totals.unrealizedPercent,
          }}
          footer="Açık pozisyon K/Z"
        />
        {totals.byGroup.map((g) => (
          <KpiCard
            key={g.id}
            label={g.label}
            hint={GROUP_HINT[g.id] ?? ''}
            bucket={g.bucket}
            footer={rateFooter(g.id, summary)}
          />
        ))}
      </ScrollRail>

      <SplitPane splitKey="overview" a={portfolioPanel} b={rightPanel} />
    </div>
  )
}
