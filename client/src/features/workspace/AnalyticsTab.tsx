import { useState } from 'react'

import type { PortfolioClosedPosition, PortfolioSummary } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane } from './split'
import { Loading, Notice } from './shared'
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker'
import { computeAnalytics, type Analytics } from './analytics-calc'
import { fmtMoney, fmtPct, fmtSignedMoney, plColor } from './portfolio-calc'

/** One share of the allocation arc, in the order the legend lists them. */
const TYPE_COLOR: Record<string, string> = {
  stock: 'var(--info)',
  us_stock: 'var(--up)',
  fund: 'var(--warn)',
}

function Row({
  label,
  value,
  color,
  hint,
  strong,
}: {
  label: string
  value: string
  color?: string
  hint?: string
  strong?: boolean
}) {
  return (
    <div className="border-faint2 flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0">
      <div>
        <span className={strong ? 'text-[13px] font-medium' : 'text-mid text-[13px]'}>{label}</span>
        {hint && <span className="text-mid ml-1.5 text-[11px]">{hint}</span>}
      </div>
      <span
        className={`num shrink-0 whitespace-nowrap ${strong ? 'text-[17px] font-semibold' : 'text-[14px] font-medium'}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Half-circle allocation arc. Each slice is drawn as the same path with a
 * dash offset, so the segments meet exactly without gap-filling maths.
 */
function AllocationArc({ byType }: { byType: Analytics['byType'] }) {
  const LENGTH = 251.3 // path length of the semicircle below
  let offset = 0
  return (
    <svg viewBox="0 0 200 115" className="w-full" role="img" aria-label="Tür dağılımı">
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="var(--faint2)"
        strokeWidth="16"
        strokeLinecap="butt"
      />
      {byType.map((t) => {
        const len = (t.share / 100) * LENGTH
        const dash = `${len} ${LENGTH}`
        const el = (
          <path
            key={t.key}
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={TYPE_COLOR[t.key] ?? 'var(--mid)'}
            strokeWidth="16"
            strokeLinecap="butt"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
          />
        )
        offset += len
        return el
      })}
    </svg>
  )
}

/** Section heading inside a panel. */
function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="border-faint mt-5 mb-1 flex items-baseline justify-between gap-2 border-t pt-4">
      <h3 className="m-0 text-[13px] font-medium">{children}</h3>
      {hint && <span className="text-mid text-[11px]">{hint}</span>}
    </div>
  )
}

/** One counter in the performance grid. */
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-mid text-[11px]">{label}</div>
      <div className="num text-[20px] font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  )
}

/**
 * Per-type P/L, drawn as bars scaled to the largest absolute contribution so a
 * small loss next to a big gain stays visible rather than collapsing to a line.
 */
function PlDistribution({ byType }: { byType: Analytics['byType'] }) {
  const peak = Math.max(...byType.map((t) => Math.abs(t.bucket.pl)), 1)
  return (
    <div className="mt-1">
      {byType.map((t) => {
        const width = (Math.abs(t.bucket.pl) / peak) * 100
        const up = t.bucket.pl >= 0
        return (
          <div key={t.key} className="py-2">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="truncate text-[12px]">{t.label}</span>
              <span
                className="num text-[13px] font-medium whitespace-nowrap"
                style={{ color: plColor(t.bucket.pl) }}
              >
                {fmtSignedMoney(t.bucket.pl, '₺')} · {fmtPct(t.bucket.plPercent)}
              </span>
            </div>
            {/* Centre line: gains grow right, losses grow left. */}
            <div className="relative h-1.5 w-full">
              <div className="bg-faint2 absolute inset-0 rounded-full" />
              <div
                className="absolute top-0 h-1.5 rounded-full"
                style={{
                  width: `${width / 2}%`,
                  left: up ? '50%' : undefined,
                  right: up ? undefined : '50%',
                  background: up ? 'var(--up)' : 'var(--down)',
                }}
              />
              <div className="bg-faint absolute top-[-2px] bottom-[-2px] left-1/2 w-px" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AnalyticsTab() {
  const [range, setRange] = useState<DateRange>({ from: null, to: null })

  const { data: summary, loading, error } = useApi<PortfolioSummary>('/api/portfolio/summary')
  const { data: closed } = useApi<PortfolioClosedPosition[]>('/api/portfolio/closed')

  if (loading) return <Loading />
  if (error) return <Notice>Portföy verisi alınamadı.</Notice>

  const a = computeAnalytics(summary?.positions ?? [], closed ?? [], summary?.usdTryRate ?? 1, range)
  const rangeActive = Boolean(range.from || range.to)

  const summaryPanel = (
    <Panel
      side="a"
      title="Portföy özeti"
      right={<Chip>{summary?.positions.length ?? 0} açık pozisyon</Chip>}
    >
      <div className="mb-1">
        <div className="text-mid text-[11px]">Toplam değer</div>
        <div className="num my-1 text-[28px] font-medium tracking-[-1px]">
          {fmtMoney(a.totalValue, '₺', 0)}
        </div>
        <div className="num text-[12px]" style={{ color: plColor(a.net) }}>
          {fmtSignedMoney(a.net, '₺')} · {fmtPct(a.netPercent)}
          <span className="text-mid ml-1.5">net (gerçekleşen + gerçekleşmemiş)</span>
        </div>
      </div>

      <div className="mt-4">
        <Row label="Toplam maliyet" value={fmtMoney(a.totalCost, '₺', 0)} />
        <Row
          label="Açık pozisyon K/Z"
          value={`${fmtSignedMoney(a.unrealized, '₺')} · ${fmtPct(a.unrealizedPercent)}`}
          color={plColor(a.unrealized)}
          strong
        />
        {/* The split that answers both "how did my picks do" and "what did my
            lira do" without making the user choose one view. */}
        <Row
          label="↳ hisse hareketi"
          value={fmtSignedMoney(a.fromShares, '₺')}
          color={plColor(a.fromShares)}
        />
        <Row
          label="↳ kur etkisi"
          value={fmtSignedMoney(a.fromCurrency, '₺')}
          color={plColor(a.fromCurrency)}
          hint="ABD pozisyonlarında"
        />
        <Row
          label="Gerçekleşen K/Z"
          value={fmtSignedMoney(a.realizedLifetime, '₺')}
          color={plColor(a.realizedLifetime)}
          hint="tüm zamanlar"
          strong
        />
        {rangeActive && (
          <Row
            label="Dönem K/Z"
            value={fmtSignedMoney(a.realizedPeriod, '₺')}
            color={plColor(a.realizedPeriod)}
            hint={`${a.periodCount} satış`}
          />
        )}
      </div>

      <SectionTitle hint={rangeActive ? 'seçili dönem' : 'tüm zamanlar'}>
        Kâr/Zarar özeti
      </SectionTitle>
      <div>
        <Row
          label="Gerçekleşmemiş K/Z"
          value={fmtSignedMoney(a.unrealized, '₺')}
          color={plColor(a.unrealized)}
          hint="açık pozisyonlar"
        />
        <Row
          label={rangeActive ? 'Gerçekleşen K/Z (dönem)' : 'Gerçekleşen K/Z'}
          value={fmtSignedMoney(rangeActive ? a.realizedPeriod : a.realizedLifetime, '₺')}
          color={plColor(rangeActive ? a.realizedPeriod : a.realizedLifetime)}
        />
        {rangeActive && (
          <Row
            label="Toplam gerçekleşen K/Z"
            value={fmtSignedMoney(a.realizedLifetime, '₺')}
            color={plColor(a.realizedLifetime)}
            hint="tüm zamanlar"
          />
        )}
        <Row
          label="Net K/Z"
          value={`${fmtSignedMoney(a.net, '₺')} · ${fmtPct(a.netPercent)}`}
          color={plColor(a.net)}
          strong
        />
      </div>

      <SectionTitle>Performans metrikleri</SectionTitle>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-2">
        <Stat label="Açık pozisyon" value={String(a.openCount)} />
        <Stat
          label={rangeActive ? 'Kapatılan (dönem)' : 'Kapatılan pozisyon'}
          value={String(rangeActive ? a.closedCountPeriod : a.closedCountLifetime)}
        />
        <Stat label="Kazanan işlem" value={String(a.winners)} color="var(--up)" />
        <Stat label="Kaybeden işlem" value={String(a.losers)} color="var(--down)" />
      </div>
      {a.winRate != null && (
        <p className="text-mid mt-3 text-[11px]">
          İsabet oranı %{a.winRate.toFixed(0)}
          {rangeActive && ` · toplam ${a.closedCountLifetime} kapanış`}
        </p>
      )}

      <p className="text-mid mt-4 text-[11px] leading-[1.6]">
        ABD pozisyonlarının maliyeti alış günündeki kurla, güncel değeri bugünkü kurla
        hesaplanır. Kapanan ABD pozisyonlarında satış günü kuru saklanmadığı için bugünkü
        kur kullanılır.
      </p>
    </Panel>
  )

  const allocationPanel = (
    <Panel
      side="b"
      title="Tür dağılımı"
      right={
        summary ? <Chip>USD/TRY {summary.usdTryRate.toFixed(2)}</Chip> : undefined
      }
    >
      {a.byType.length === 0 ? (
        <PanelEmpty>Açık pozisyon yok.</PanelEmpty>
      ) : (
        <>
          <AllocationArc byType={a.byType} />
          <div className="mt-2">
            {a.byType.map((t) => (
              <div key={t.key} className="border-faint2 border-b py-2.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: TYPE_COLOR[t.key] ?? 'var(--mid)' }}
                    />
                    <span className="truncate">{t.label}</span>
                  </span>
                  <span className="num shrink-0 text-[14px] font-medium whitespace-nowrap">
                    {fmtMoney(t.bucket.value, '₺', 0)}
                  </span>
                </div>
                {/* Wraps as whole values, never mid-number: a narrowed panel
                    used to split "−₺29.978 · −%11,21" across two lines. */}
                <div className="text-mid num mt-1 flex flex-wrap justify-between gap-x-3 gap-y-0.5 pl-[18px] text-[11px]">
                  <span className="whitespace-nowrap">
                    %{t.share.toFixed(1)} pay · maliyet {fmtMoney(t.bucket.cost, '₺', 0)}
                  </span>
                  <span className="whitespace-nowrap" style={{ color: plColor(t.bucket.pl) }}>
                    {fmtSignedMoney(t.bucket.pl, '₺')} · {fmtPct(t.bucket.plPercent)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <SectionTitle hint="açık pozisyonlar">Kâr/Zarar dağılımı</SectionTitle>
          <PlDistribution byType={a.byType} />
        </>
      )}
    </Panel>
  )

  return (
    <div>
      <TabHeading
        title="Analiz"
        subtitle="Portföyün bütünü: değer, kâr-zarar ve dağılım."
        right={<DateRangePicker value={range} onChange={setRange} />}
      />
      <SplitPane splitKey="analytics" a={summaryPanel} b={allocationPanel} />
    </div>
  )
}
