import { useState } from 'react'
import { CalendarDays } from 'lucide-react'

import type { PortfolioClosedPosition, PortfolioSummary } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane } from './split'
import { Loading, Notice } from './shared'
import {
  DateRangePicker,
  formatRange,
  rangePreset,
  type DateRange,
} from '@/components/ui/date-range-picker'
import { computeAnalytics, type Analytics } from './analytics-calc'
import { fmtMoney, fmtPct, fmtSignedMoney, plColor } from './portfolio-calc'

/** One share of the allocation arc, in the order the legend lists them. */
const TYPE_COLOR: Record<string, string> = {
  stock: 'var(--info)',
  us_stock: 'var(--up)',
  fund: 'var(--warn)',
}

/** The legend wants a word, not a phrase — the full label is in the rows below. */
const TYPE_SHORT: Record<string, string> = {
  stock: 'BİST',
  us_stock: 'ABD',
  fund: 'Fon',
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
        {hint && <span className="text-mid ml-1.5 text-[12px]">{hint}</span>}
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
 * Allocation as one stacked bar.
 *
 * Replaced a half-donut arc, whose height scaled with the panel's WIDTH rather
 * than with the data: at 50–75% it grew past 400px to carry three numbers. A
 * bar costs ~45px at any width, and its legend gives the share percentages a
 * place of their own instead of the grey sub-line they were buried in.
 */
function AllocationBar({ byType }: { byType: Analytics['byType'] }) {
  return (
    <div className="mt-2">
      <div
        className="flex h-2 w-full gap-[3px]"
        role="img"
        aria-label={byType.map((t) => `${t.label} %${t.share.toFixed(1)}`).join(', ')}
      >
        {byType.map((t) => (
          // Percentage widths overflow once the gaps are added, so the segments
          // shrink to fit — proportionally, which keeps the shares honest.
          // min-width keeps a sliver of a 1% holding visible in a narrow panel.
          <div
            key={t.key}
            className="min-w-[3px] rounded-full"
            style={{ width: `${t.share}%`, background: TYPE_COLOR[t.key] ?? 'var(--mid)' }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {byType.map((t) => (
          <span key={t.key} className="flex items-center gap-1.5 text-[12px] whitespace-nowrap">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: TYPE_COLOR[t.key] ?? 'var(--mid)' }}
            />
            <span className="text-mid">{TYPE_SHORT[t.key] ?? t.label}</span>
            <span className="num font-medium">%{t.share.toFixed(1)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Dot() {
  return (
    <span className="text-faint text-[12px]" aria-hidden="true">
      ·
    </span>
  )
}

function Count({ value, noun }: { value: number; noun: string }) {
  return (
    <span className="text-mid text-[12px] whitespace-nowrap">
      <span className="num text-ink mr-0.5 text-[13px] font-semibold">{value}</span>
      {noun}
    </span>
  )
}

/**
 * The one line the date picker implies but doesn't show: how much actually
 * happened in the selected period.
 *
 * Over all time the counts are worded as STATE, not events — "17 açık pozisyon"
 * rather than "17 pozisyon açıldı" — because across all time those describe the
 * portfolio as it stands. Deliberately uncoloured: opening and closing are
 * events, and green here would read as profit.
 */
function PeriodBand({ range, a }: { range: DateRange; a: Analytics }) {
  const preset = rangePreset(range)
  const allTime = preset === 'all'
  const label = preset === 'today' ? 'Bugün' : preset === 'month' ? 'Bu ay' : formatRange(range)
  const idle = !allTime && a.openedCountPeriod === 0 && a.closedCountPeriod === 0

  return (
    <div className="bg-card border-faint flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border px-3.5 py-2.5">
      <CalendarDays size={14} className="text-mid shrink-0" />
      <span className="text-[13px] font-medium">{allTime ? 'Tüm zamanlar' : label}</span>
      <Dot />
      {allTime ? (
        <>
          <Count value={a.openCount} noun="açık pozisyon" />
          <Dot />
          <Count value={a.closedCountLifetime} noun="kapanmış pozisyon" />
        </>
      ) : idle ? (
        // Two zeroes say less than the sentence does.
        <span className="text-mid text-[12px]">işlem yapılmadı</span>
      ) : (
        <>
          <Count value={a.openedCountPeriod} noun="pozisyon açıldı" />
          <Dot />
          <Count value={a.closedCountPeriod} noun="pozisyon kapatıldı" />
        </>
      )}
    </div>
  )
}

/** Section heading inside a panel. */
function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="border-faint mt-5 mb-1 flex items-baseline justify-between gap-2 border-t pt-4">
      <h3 className="m-0 text-[13px] font-medium">{children}</h3>
      {hint && <span className="text-mid text-[12px]">{hint}</span>}
    </div>
  )
}

/** One counter in the performance grid. */
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-mid text-[12px]">{label}</div>
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
        <div className="text-mid text-[12px]">Toplam değer</div>
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
        <p className="text-mid mt-3 text-[12px]">
          İsabet oranı %{a.winRate.toFixed(0)}
          {rangeActive && ` · toplam ${a.closedCountLifetime} kapanış`}
        </p>
      )}

      <p className="text-mid mt-4 text-[12px] leading-[1.6]">
        ABD pozisyonlarının maliyeti alış günündeki kurla, güncel değeri bugünkü kurla
        hesaplanır. Kapanan ABD pozisyonlarında satış günü kuru saklanmadığı için bugünkü
        kur kullanılır.
      </p>
    </Panel>
  )

  const allocationPanel = (
    <Panel
      side="b"
      title="Dağılım"
      right={
        summary ? <Chip>USD/TRY {summary.usdTryRate.toFixed(2)}</Chip> : undefined
      }
    >
      {a.byType.length === 0 ? (
        <PanelEmpty>Açık pozisyon yok.</PanelEmpty>
      ) : (
        <>
          <AllocationBar byType={a.byType} />
          {/* The bar's legend owns the colour key and the share, so the rows
              below carry neither — each fact is stated once. */}
          <div className="mt-4">
            {a.byType.map((t) => (
              <div key={t.key} className="border-faint2 border-b py-2.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px] font-medium">{t.label}</span>
                  <span className="num shrink-0 text-[14px] font-medium whitespace-nowrap">
                    {fmtMoney(t.bucket.value, '₺', 0)}
                  </span>
                </div>
                {/* Wraps as whole values, never mid-number: a narrowed panel
                    used to split "−₺29.978 · −%11,21" across two lines. */}
                <div className="text-mid num mt-1 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[12px]">
                  <span className="whitespace-nowrap">
                    maliyet {fmtMoney(t.bucket.cost, '₺', 0)}
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
        below={<PeriodBand range={range} a={a} />}
      />
      <SplitPane splitKey="analytics" a={summaryPanel} b={allocationPanel} />
    </div>
  )
}
