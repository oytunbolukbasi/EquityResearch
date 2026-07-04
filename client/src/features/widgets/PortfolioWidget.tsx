import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { IoSwapHorizontal, IoSparkles, IoClose } from 'react-icons/io5'

import type { PortfolioAction, PortfolioClosedPosition, PortfolioInsight, PortfolioPosition, PortfolioSummary } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { StatusTabs, type StatusTab } from './StatusTabs'

type PlDisplayMode = 'percent' | 'value'

function Loading() {
  return (
    <div className="flex h-32 items-center justify-center">
      <Loader2 className="size-5 animate-spin text-mid" />
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center">
      <p className="text-sm text-mid">{children}</p>
    </div>
  )
}

function fmtMoney(n: number | null, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtQty(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// currencyPrefix: '' for TL/fund positions (matches the rest of the table,
// which shows bare TL numbers with no unit), '$' for us_stock so the value
// mode doesn't read as a TL amount.
function fmtPlValue(n: number, currencyPrefix: string): string {
  const sign = n >= 0 ? '+' : '-'
  return `${sign}${currencyPrefix}${fmtMoney(Math.abs(n))}`
}

const TYPE_LABEL: Record<string, string> = {
  stock: 'TL',
  fund: 'Fon',
  us_stock: 'USD',
}

const TYPE_CURRENCY_PREFIX: Record<string, string> = {
  stock: '',
  fund: '',
  us_stock: '$',
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: '#f5f4f0', color: '#6b6b67' }}>
      {TYPE_LABEL[type] ?? type}
    </span>
  )
}

function PlText({
  n, pct, mode, currencyPrefix = '',
}: {
  n: number | null
  pct: number | null
  mode: PlDisplayMode
  currencyPrefix?: string
}) {
  if (n == null || pct == null) return <span className="num text-mid">—</span>
  const isUp = pct >= 0
  const text = mode === 'percent' ? fmtPct(pct) : fmtPlValue(n, currencyPrefix)
  return (
    <span className={`num font-medium ${isUp ? 'text-up' : 'text-down'}`}>
      {text}
    </span>
  )
}

// ─── currency summary block ────────────────────────────────────────────────
function CurrencyBlock({
  title, costBasis, currentValue, plAmount, plPercent, note,
}: {
  title: string
  costBasis: number
  currentValue: number | null
  plAmount: number | null
  plPercent: number | null
  note?: string
}) {
  return (
    <div className="rounded-lg border border-faint2 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-mid">{title}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-mid">Maliyet</span>
          <span className="num font-medium text-ink">{fmtMoney(costBasis, 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-mid">Güncel Değer</span>
          <span className="num font-medium text-ink">{currentValue != null ? fmtMoney(currentValue, 0) : '—'}</span>
        </div>
        <div className="flex items-center justify-between border-t border-faint2 pt-1.5">
          <span className="text-mid">K/Z</span>
          <span className="flex items-center gap-1.5">
            {plAmount != null && (
              <span className={`num font-medium ${plAmount >= 0 ? 'text-up' : 'text-down'}`}>
                {plAmount >= 0 ? '+' : ''}{fmtMoney(plAmount, 0)}
              </span>
            )}
            <PlText n={plAmount} pct={plPercent} mode="percent" />
          </span>
        </div>
      </div>
      {note && <p className="mt-2 text-[10px] leading-relaxed text-mid opacity-75">{note}</p>}
    </div>
  )
}

// ─── action badge colors ────────────────────────────────────────────────────
const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  'BEKLE':           { bg: '#eef3fb', color: '#2563a8' },
  'KISMİ KÂR AL':   { bg: '#edf5f2', color: '#1a7a5e' },
  'SAT':             { bg: '#fdf0ee', color: '#c0392b' },
  'POZİSYON ARTIR':  { bg: '#e0f0e5', color: '#15603d' },
}

// ─── liquid glass modal ─────────────────────────────────────────────────────
function ActionModal({ action, onClose }: { action: PortfolioAction; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 180)
  }

  const style = ACTION_STYLE[action.action] ?? { bg: '#f5f4f0', color: '#6b6b67' }

  return createPortal(
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) handleClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: visible ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0)',
        transition: 'background 180ms ease',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
          borderRadius: 16,
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
          transition: 'transform 180ms ease, opacity 180ms ease',
          maxWidth: 380,
          width: '100%',
        }}
      >
        <div className="flex items-start justify-between p-5 pb-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-base font-bold text-ink">{action.ticker}</span>
            <span
              className="num rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: style.bg, color: style.color }}
            >
              {action.action}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-mid transition-colors hover:bg-black/5 hover:text-ink"
          >
            <IoClose size={16} />
          </button>
        </div>
        <div className="p-5 pt-3">
          <p className="text-sm leading-relaxed text-ink/80">{action.reason}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── active positions table ─────────────────────────────────────────────────
function PositionsTable({
  positions, plMode, onTogglePlMode, actionsMap,
}: {
  positions: PortfolioPosition[]
  plMode: PlDisplayMode
  onTogglePlMode: () => void
  actionsMap: Map<string, PortfolioAction>
}) {
  const [modalAction, setModalAction] = useState<PortfolioAction | null>(null)

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-faint bg-card">
            <th className="num px-4 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Sembol</th>
            <th className="num px-3 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Tip</th>
            <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Miktar</th>
            <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Maliyet</th>
            <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Güncel Fiyat</th>
            <th className="num px-4 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                {plMode === 'percent' ? 'K/Z %' : 'K/Z'}
                <button
                  onClick={onTogglePlMode}
                  title="Yüzde / değer göster"
                  aria-label="K/Z gösterim modunu değiştir"
                  className="rounded p-0.5 text-mid transition-colors hover:text-ink"
                >
                  <IoSwapHorizontal size={12} />
                </button>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => {
            const action = actionsMap.get(p.symbol)
            return (
              <tr key={p.id} className="border-b border-faint2 hover:bg-bg">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex w-[18px] shrink-0 justify-center">
                      {action ? (
                        <button
                          onClick={() => setModalAction(action)}
                          title={`${action.ticker}: ${action.action}`}
                          className="rounded p-0.5 text-amber-500 transition-colors hover:text-amber-600"
                        >
                          <IoSparkles size={13} />
                        </button>
                      ) : null}
                    </span>
                    <div>
                      <div className="font-mono font-semibold text-sm">{p.symbol}</div>
                      {p.name && <div className="truncate text-[10px] text-mid" style={{ maxWidth: 140 }}>{p.name}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <TypeBadge type={p.type} />
                </td>
                <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">{fmtQty(p.quantity)}</td>
                <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">{fmtMoney(p.buyPrice)}</td>
                <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">
                  {p.currentPrice != null ? fmtMoney(p.currentPrice) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <PlText n={p.plAmount} pct={p.plPercent} mode={plMode} currencyPrefix={TYPE_CURRENCY_PREFIX[p.type] ?? ''} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {modalAction && <ActionModal action={modalAction} onClose={() => setModalAction(null)} />}
    </>
  )
}

// ─── closed positions table ─────────────────────────────────────────────────
function ClosedTable({ closed }: { closed: PortfolioClosedPosition[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          <th className="num px-4 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Sembol</th>
          <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Miktar</th>
          <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Alış</th>
          <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Satış</th>
          <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">K/Z</th>
          <th className="num px-4 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">K/Z %</th>
        </tr>
      </thead>
      <tbody>
        {closed.map((c, i) => (
          <tr key={`${c.symbol}-${c.sellDate}-${i}`} className="border-b border-faint2 hover:bg-bg">
            <td className="px-4 py-2.5">
              <div className="font-mono font-semibold text-sm">{c.symbol}</div>
              <div className="num text-[10px] text-mid">{c.sellDate.slice(0, 10)}</div>
            </td>
            <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">{fmtQty(c.quantity)}</td>
            <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">{fmtMoney(c.buyPrice)}</td>
            <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">{fmtMoney(c.sellPrice)}</td>
            <td className={`num px-3 py-2.5 text-right text-xs whitespace-nowrap font-medium ${c.pl >= 0 ? 'text-up' : 'text-down'}`}>
              {c.pl >= 0 ? '+' : ''}{fmtMoney(c.pl, 0)}
            </td>
            <td className="px-4 py-2.5 text-right">
              <PlText n={c.pl} pct={c.plPercent} mode="percent" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── main widget ─────────────────────────────────────────────────────────────
export function PortfolioWidget() {
  const [tab, setTab] = useState<StatusTab>('active')
  const [plMode, setPlMode] = useState<PlDisplayMode>('percent')

  const { data: summary, loading: loadingSummary, error: errorSummary } = useApi<PortfolioSummary>('/api/portfolio/summary')
  const { data: closed, loading: loadingClosed, error: errorClosed } = useApi<PortfolioClosedPosition[]>('/api/portfolio/closed')
  const { data: insight } = useApi<PortfolioInsight | null>('/api/portfolio/insight')

  const loading = tab === 'active' ? loadingSummary : loadingClosed
  const error = tab === 'active' ? errorSummary : errorClosed

  if (loading) return <Loading />
  if (error) return <Empty>Veri alınamadı.</Empty>

  const positions = summary?.positions ?? []
  const tlPositions = positions.filter(p => p.type === 'stock' || p.type === 'fund')
  const usdPositions = positions.filter(p => p.type === 'us_stock')

  const tlCostBasis = tlPositions.reduce((s, p) => s + p.costBasis, 0)
  const tlHasAllValues = tlPositions.every(p => p.currentValue != null)
  const tlCurrentValue = tlHasAllValues ? tlPositions.reduce((s, p) => s + (p.currentValue ?? 0), 0) : null
  const tlPlAmount = tlCurrentValue != null ? tlCurrentValue - tlCostBasis : null
  const tlPlPercent = tlPlAmount != null && tlCostBasis !== 0 ? (tlPlAmount / tlCostBasis) * 100 : null

  const usdCostBasisTRY = usdPositions.reduce((s, p) => s + (p.costBasisTRY ?? 0), 0)
  const usdHasAllValuesTRY = usdPositions.every(p => p.currentValueTRY != null)
  const usdCurrentValueTRY = usdHasAllValuesTRY ? usdPositions.reduce((s, p) => s + (p.currentValueTRY ?? 0), 0) : null
  const usdPlAmountTRY = usdCurrentValueTRY != null ? usdCurrentValueTRY - usdCostBasisTRY : null
  const usdPlPercentTRY = usdPlAmountTRY != null && usdCostBasisTRY !== 0 ? (usdPlAmountTRY / usdCostBasisTRY) * 100 : null

  const actionsMap = new Map<string, PortfolioAction>()
  if (insight?.actions) {
    for (const a of insight.actions) actionsMap.set(a.ticker, a)
  }

  const rateNote = summary
    ? summary.usdTryRateIsFallback
      ? `Kur: ~${fmtMoney(summary.usdTryRate)} TL (tahmini, API erişilemedi)`
      : `Kur: 1 USD = ${fmtMoney(summary.usdTryRate)} TL (Frankfurter API)`
    : undefined

  return (
    <div className="flex h-full flex-col">
      <StatusTabs tab={tab} onChange={setTab} />

      {tab === 'active' ? (
        <div className="-m-4 mt-0 flex min-h-0 flex-1 flex-col overflow-auto p-4 pt-0">
          {/* Currency summary blocks */}
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CurrencyBlock
              title="TL Pozisyonlar"
              costBasis={tlCostBasis}
              currentValue={tlCurrentValue}
              plAmount={tlPlAmount}
              plPercent={tlPlPercent}
            />
            <CurrencyBlock
              title="USD Pozisyonlar"
              costBasis={usdCostBasisTRY}
              currentValue={usdCurrentValueTRY}
              plAmount={usdPlAmountTRY}
              plPercent={usdPlPercentTRY}
              note={rateNote}
            />
          </div>

          {/* Insight — short summary only */}
          <div className="mb-3 rounded-lg border border-faint2 px-4 py-3.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-mid">Günlük Analiz</p>
            {insight?.body ? (
              <p className="text-[13px] leading-[1.65] text-ink">{insight.body}</p>
            ) : (
              <p className="text-[13px] text-mid">Henüz analiz yok.</p>
            )}
          </div>

          {/* Table */}
          {!positions.length ? (
            <Empty>Açık pozisyon yok.</Empty>
          ) : (
            <div className="-mx-4 flex-1 overflow-auto">
              <PositionsTable
                positions={positions}
                plMode={plMode}
                onTogglePlMode={() => setPlMode(m => m === 'percent' ? 'value' : 'percent')}
                actionsMap={actionsMap}
              />
            </div>
          )}
        </div>
      ) : (
        !closed?.length ? (
          <Empty>Geçmiş pozisyon yok.</Empty>
        ) : (
          <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
            <ClosedTable closed={closed} />
          </div>
        )
      )}
    </div>
  )
}
