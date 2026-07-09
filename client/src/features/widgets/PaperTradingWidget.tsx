import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { IoClose } from 'react-icons/io5'

import { useApi } from '@/lib/use-api'

// ─── Alpaca types ──────────────────────────────────────────────────────────────

interface AlpacaAccount {
  equity: string
  buying_power: string
  cash: string
  last_equity: string
  unrealized_pl: string
  long_market_value: string
}

interface AlpacaPosition {
  symbol: string
  qty: string
  avg_entry_price: string
  current_price: string
  unrealized_pl: string
  unrealized_plpc: string
  market_value: string
  cost_basis: string
  side: 'long' | 'short'
  exchange: string
  created_at: string
}

interface AlpacaOrder {
  id: string
  symbol: string
  qty: string
  side: 'buy' | 'sell'
  type: string
  time_in_force: string
  limit_price: string | null
  status: string
  created_at: string
}

interface ClosedPaperPosition {
  symbol: string
  qty: number
  entryPrice: number
  exitPrice: number
  pl: number
  plPct: number
  closedAt: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(n: number | null, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── shared UI ────────────────────────────────────────────────────────────────

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

// ─── tabs ─────────────────────────────────────────────────────────────────────

type PaperTab = 'positions' | 'closed' | 'orders'

const PAPER_TABS: { key: PaperTab; label: string }[] = [
  { key: 'positions', label: 'Aktif Pozisyonlar' },
  { key: 'closed',    label: 'Kapalı Pozisyonlar' },
  { key: 'orders',    label: 'Bekleyen Emirler' },
]

function PaperTabs({ tab, onChange }: { tab: PaperTab; onChange: (t: PaperTab) => void }) {
  return (
    <div className="mb-3 flex gap-3 border-b border-faint">
      {PAPER_TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={[
            'num -mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors whitespace-nowrap',
            tab === key
              ? 'border-info text-info'
              : 'border-transparent text-mid hover:text-ink',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── summary cards ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  variant = 'neutral',
}: {
  label: string
  value: React.ReactNode
  sub?: string
  variant?: 'up' | 'down' | 'neutral'
}) {
  const cls = { up: 'text-up', down: 'text-down', neutral: 'text-ink' }[variant]
  return (
    <div className="rounded-lg border border-faint2 p-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-mid">{label}</p>
      <p className={`num text-[18px] font-semibold leading-none ${cls}`}>{value}</p>
      {sub && <p className="num mt-1 text-[10px] text-mid">{sub}</p>}
    </div>
  )
}

// ─── active positions table ────────────────────────────────────────────────────

function ActivePositionsTable({ positions }: { positions: AlpacaPosition[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          {['Sembol', 'Miktar', 'Giriş Fiyatı', 'Güncel Fiyat', 'K/Z', 'K/Z %', 'Piyasa Değeri', 'Açılış Tarihi'].map(h => (
            <th key={h} className="num px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-mid whitespace-nowrap first:pl-4 last:pr-4">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map(p => {
          const pl = parseFloat(p.unrealized_pl)
          const plPct = parseFloat(p.unrealized_plpc) * 100
          const isUp = pl >= 0
          return (
            <tr key={p.symbol} className="border-b border-faint2 hover:bg-bg">
              <td className="pl-4 pr-3 py-2.5">
                <div className="font-semibold text-sm">{p.symbol}</div>
                <div className="num text-[10px] text-mid">{p.exchange}</div>
              </td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">{p.qty}</td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">${fmtUsd(parseFloat(p.avg_entry_price))}</td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">
                {p.current_price ? `$${fmtUsd(parseFloat(p.current_price))}` : '—'}
              </td>
              <td className={`num px-3 py-2.5 text-xs font-medium whitespace-nowrap ${isUp ? 'text-up' : 'text-down'}`}>
                {pl >= 0 ? '+' : ''}${fmtUsd(Math.abs(pl))}
              </td>
              <td className={`num px-3 py-2.5 text-xs font-medium whitespace-nowrap ${isUp ? 'text-up' : 'text-down'}`}>
                {fmtPct(plPct)}
              </td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">${fmtUsd(parseFloat(p.market_value))}</td>
              <td className="num pr-4 pl-3 py-2.5 text-xs whitespace-nowrap text-mid">{fmtDate(p.created_at)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── closed positions table ────────────────────────────────────────────────────

function ClosedPositionsTable({ positions }: { positions: ClosedPaperPosition[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          {['Sembol', 'Miktar', 'Giriş', 'Çıkış', 'K/Z', 'K/Z %', 'Kapanış Tarihi'].map(h => (
            <th key={h} className="num px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-mid whitespace-nowrap first:pl-4 last:pr-4">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => {
          const isUp = p.pl >= 0
          return (
            <tr key={`${p.symbol}-${i}`} className="border-b border-faint2 hover:bg-bg">
              <td className="pl-4 pr-3 py-2.5">
                <div className="font-semibold text-sm">{p.symbol}</div>
              </td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">{p.qty}</td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">${fmtUsd(p.entryPrice)}</td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">${fmtUsd(p.exitPrice)}</td>
              <td className={`num px-3 py-2.5 text-xs font-medium whitespace-nowrap ${isUp ? 'text-up' : 'text-down'}`}>
                {p.pl >= 0 ? '+' : ''}${fmtUsd(Math.abs(p.pl))}
              </td>
              <td className={`num px-3 py-2.5 text-xs font-medium whitespace-nowrap ${isUp ? 'text-up' : 'text-down'}`}>
                {fmtPct(p.plPct)}
              </td>
              <td className="num pr-4 pl-3 py-2.5 text-xs whitespace-nowrap text-mid">{fmtDate(p.closedAt)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── open orders table ────────────────────────────────────────────────────────

const ORDER_TYPE_LABEL: Record<string, string> = {
  limit:       'Limit',
  market:      'Market',
  stop:        'Stop',
  stop_limit:  'Stop-Limit',
  trailing_stop: 'Trailing Stop',
}

const ORDER_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  new:            { bg: '#eef3fb', color: '#2563a8' },
  partially_filled: { bg: '#fef8e9', color: '#9a6200' },
  accepted:       { bg: '#eef3fb', color: '#2563a8' },
  pending_new:    { bg: '#eef3fb', color: '#2563a8' },
}

function OrdersTable({
  orders,
  onCancel,
}: {
  orders: AlpacaOrder[]
  onCancel: (o: AlpacaOrder) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          {['Sembol', 'Tip', 'Yön', 'Miktar', 'Limit Fiyat', 'Durum', 'Oluşturma Tarihi', ''].map((h, i) => (
            <th key={i} className="num px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-mid whitespace-nowrap first:pl-4 last:pr-4">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => {
          const style = ORDER_STATUS_STYLE[o.status] ?? { bg: '#f5f4f0', color: '#9a9a94' }
          return (
            <tr key={o.id} className="border-b border-faint2 hover:bg-bg">
              <td className="pl-4 pr-3 py-2.5 font-semibold text-sm">{o.symbol}</td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap text-mid">
                {ORDER_TYPE_LABEL[o.type] ?? o.type}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className="num rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                  style={o.side === 'buy'
                    ? { background: '#edf5f2', color: '#1a7a5e' }
                    : { background: '#fdf0ee', color: '#c0392b' }}
                >
                  {o.side === 'buy' ? 'Alış' : 'Satış'}
                </span>
              </td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">{o.qty}</td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap">
                {o.limit_price ? `$${fmtUsd(parseFloat(o.limit_price))}` : '—'}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: style.bg, color: style.color }}
                >
                  {o.status}
                </span>
              </td>
              <td className="num px-3 py-2.5 text-xs whitespace-nowrap text-mid">{fmtDate(o.created_at)}</td>
              <td className="pr-4 pl-3 py-2.5 text-right">
                <button
                  onClick={() => onCancel(o)}
                  title="Emri iptal et"
                  className="rounded px-2 py-1 text-[10px] font-medium text-down border border-down/25 hover:bg-down/5 transition-colors num"
                >
                  İptal
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── cancel modal ──────────────────────────────────────────────────────────────

function CancelModal({
  order,
  onConfirm,
  onClose,
  cancelling,
}: {
  order: AlpacaOrder
  onConfirm: () => void
  onClose: () => void
  cancelling: boolean
}) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    if (cancelling) return
    setVisible(false)
    setTimeout(onClose, 180)
  }

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
          maxWidth: 360,
          width: '100%',
        }}
      >
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-ink">{order.symbol}</p>
              <p className="mt-0.5 text-sm text-mid">
                {order.side === 'buy' ? 'Alış' : 'Satış'} · {ORDER_TYPE_LABEL[order.type] ?? order.type}
                {order.limit_price ? ` · $${fmtUsd(parseFloat(order.limit_price))}` : ''}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-1 text-mid transition-colors hover:bg-black/5 hover:text-ink"
            >
              <IoClose size={16} />
            </button>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-ink/80">Bu emri iptal etmek istiyor musunuz?</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              disabled={cancelling}
              className="num rounded-lg border border-faint2 px-4 py-2 text-sm text-mid transition-colors hover:text-ink disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              onClick={onConfirm}
              disabled={cancelling}
              className="num flex items-center gap-2 rounded-lg border border-down/20 bg-down/10 px-4 py-2 text-sm font-medium text-down transition-colors hover:bg-down/20 disabled:opacity-50"
            >
              {cancelling && <Loader2 className="size-3.5 animate-spin" />}
              Emri İptal Et
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── main widget ──────────────────────────────────────────────────────────────

export function PaperTradingWidget() {
  const [tab, setTab] = useState<PaperTab>('positions')
  const [cancelTarget, setCancelTarget] = useState<AlpacaOrder | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [ordersVersion, setOrdersVersion] = useState(0)

  const { data: positions, loading: posLoading, error: posError } =
    useApi<AlpacaPosition[]>('/api/paper-trading/positions')

  const { data: closedPositions, loading: closedLoading } =
    useApi<ClosedPaperPosition[]>('/api/paper-trading/closed-positions')

  const { data: openOrders, loading: ordersLoading } =
    useApi<AlpacaOrder[]>(`/api/paper-trading/orders?status=open&_v=${ordersVersion}`)

  // Summary computations
  const unrealizedPl = (positions ?? []).reduce((s, p) => s + parseFloat(p.unrealized_pl), 0)
  const realizedPl = (closedPositions ?? []).reduce((s, p) => s + p.pl, 0)
  const totalPl = unrealizedPl + realizedPl
  const winCount = (closedPositions ?? []).filter(p => p.pl > 0).length
  const lossCount = (closedPositions ?? []).filter(p => p.pl < 0).length

  async function handleCancelConfirm() {
    if (!cancelTarget) return
    const adminKey = localStorage.getItem('eqr:admin-key') ?? ''
    setCancelling(true)
    try {
      await fetch(`/api/paper-trading/orders/${cancelTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      })
      setOrdersVersion(v => v + 1)
      setCancelTarget(null)
    } finally {
      setCancelling(false)
    }
  }

  const totalPlSign = totalPl >= 0 ? '+' : '-'
  const totalPlClass = totalPl >= 0 ? 'up' as const : 'down' as const

  if (posError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-mid">Alpaca bağlantısı kurulamadı.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Summary */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard
          label="Toplam K/Z"
          value={`${totalPlSign}$${fmtUsd(Math.abs(totalPl))}`}
          sub={positions ? `Açık: ${unrealizedPl >= 0 ? '+' : ''}$${fmtUsd(unrealizedPl)}` : undefined}
          variant={totalPlClass}
        />
        <SummaryCard
          label="Kazanan İşlem"
          value={closedPositions ? String(winCount) : '—'}
          variant="up"
        />
        <SummaryCard
          label="Kaybeden İşlem"
          value={closedPositions ? String(lossCount) : '—'}
          variant="down"
        />
        <SummaryCard
          label="Açık Pozisyon"
          value={positions ? String(positions.length) : '—'}
          variant="neutral"
        />
      </div>

      {/* Tabs */}
      <PaperTabs tab={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === 'positions' && (
        posLoading ? <Loading /> :
        !positions?.length ? <Empty>Açık pozisyon yok.</Empty> :
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <ActivePositionsTable positions={positions} />
        </div>
      )}

      {tab === 'closed' && (
        closedLoading ? <Loading /> :
        !closedPositions?.length ? <Empty>Kapalı pozisyon yok.</Empty> :
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <ClosedPositionsTable positions={closedPositions} />
        </div>
      )}

      {tab === 'orders' && (
        ordersLoading ? <Loading /> :
        !openOrders?.length ? <Empty>Bekleyen emir yok.</Empty> :
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <OrdersTable orders={openOrders} onCancel={setCancelTarget} />
        </div>
      )}

      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
          cancelling={cancelling}
        />
      )}
    </div>
  )
}
