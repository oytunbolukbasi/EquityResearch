import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MoreHorizontal } from 'lucide-react'

import { useApi } from '@/lib/use-api'

// ─── Alpaca types ──────────────────────────────────────────────────────────────

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
  submitted_at?: string
  filled_at?: string
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

// Alpaca returns ISO 8601 strings (e.g. "2024-01-15T14:32:00.000Z") or occasionally
// Unix timestamps as numbers. Parse both; return "—" if unparseable.
function fmtDate(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return '—'
  const d = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
  if (isNaN(d.getTime())) return '—'
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

// ─── compact KPI bar ──────────────────────────────────────────────────────────

interface KpiItem { label: string; value: React.ReactNode; colorClass?: string }

function KpiBar({ items }: { items: KpiItem[] }) {
  return (
    <div className="mb-3 flex overflow-hidden rounded-lg border border-faint2 divide-x divide-faint2">
      {items.map(({ label, value, colorClass = 'text-ink' }, i) => (
        <div key={i} className="flex-1 px-4 py-2.5 min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-mid leading-none truncate">
            {label}
          </p>
          <p className={`num text-base font-semibold leading-none ${colorClass}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

type PaperTab = 'positions' | 'closed' | 'orders'

const TAB_DEFS: { key: PaperTab; label: string }[] = [
  { key: 'positions', label: 'Aktif Pozisyonlar' },
  { key: 'closed',    label: 'Kapalı Pozisyonlar' },
  { key: 'orders',    label: 'Bekleyen Emirler' },
]

function PaperTabs({
  tab,
  onChange,
  counts,
}: {
  tab: PaperTab
  onChange: (t: PaperTab) => void
  counts: Record<PaperTab, number>
}) {
  return (
    <div className="mb-3 flex gap-3 border-b border-faint">
      {TAB_DEFS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={[
            '-mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap',
            tab === key
              ? 'border-info text-info'
              : 'border-transparent text-mid hover:text-ink',
          ].join(' ')}
        >
          {label} ({counts[key]})
        </button>
      ))}
    </div>
  )
}

// ─── RowActions ───────────────────────────────────────────────────────────────

interface RowActionDef {
  label: string
  destructive?: boolean
  confirmMessage?: string
  confirmLabel?: string
  onExecute: () => Promise<void>
}

function RowActions({ actions }: { actions: RowActionDef[] }) {
  const [open, setOpen]           = useState(false)
  const [visible, setVisible]     = useState(false)
  const [confirming, setConfirming] = useState<RowActionDef | null>(null)
  const [executing, setExecuting] = useState(false)
  const [pos, setPos]             = useState<{ top: number; right: number } | null>(null)
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const popoverRef  = useRef<HTMLDivElement>(null)

  function openPopover() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setConfirming(null)
    setOpen(true)
    requestAnimationFrame(() => setVisible(true))
  }

  function close() {
    setVisible(false)
    setOpen(false)
    setConfirming(null)
    setExecuting(false)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function execute(action: RowActionDef) {
    setExecuting(true)
    try { await action.onExecute() }
    finally { close() }
  }

  const transitionStyle = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-4px)',
    transition: 'opacity 150ms ease, transform 150ms ease',
  } as const

  return (
    <div className="flex justify-end">
      <button
        ref={triggerRef}
        onClick={openPopover}
        aria-label="Eylemler"
        className="rounded p-1.5 text-mid opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 hover:bg-black/5 hover:text-ink"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 200, ...transitionStyle }}
        >
          {confirming ? (
            <div className="w-52 rounded-xl border border-faint2 bg-card p-3 shadow-lg">
              <p className="mb-3 text-xs leading-relaxed text-ink">{confirming.confirmMessage}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={close}
                  disabled={executing}
                  className="rounded-lg border border-faint2 px-3 py-1.5 text-xs text-mid transition-colors duration-150 hover:text-ink disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={() => execute(confirming)}
                  disabled={executing}
                  className="flex items-center gap-1.5 rounded-lg border border-down/20 bg-down/10 px-3 py-1.5 text-xs font-medium text-down transition-colors duration-150 hover:bg-down/20 disabled:opacity-50"
                >
                  {executing && <Loader2 className="size-3 animate-spin" />}
                  {confirming.confirmLabel ?? 'Onayla'}
                </button>
              </div>
            </div>
          ) : (
            <div className="min-w-[160px] overflow-hidden rounded-xl border border-faint2 bg-card shadow-lg">
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => action.confirmMessage ? setConfirming(action) : void execute(action)}
                  className={[
                    'w-full px-3 py-2.5 text-left text-xs transition-colors duration-150 hover:bg-black/5',
                    action.destructive ? 'font-medium text-down' : 'text-ink',
                  ].join(' ')}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── th helper ────────────────────────────────────────────────────────────────

function Th({ children, align = 'right' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={[
        'px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-mid whitespace-nowrap',
        align === 'left' ? 'text-left' : 'text-right',
      ].join(' ')}
    >
      {children}
    </th>
  )
}

// ─── active positions table ───────────────────────────────────────────────────

function ActivePositionsTable({
  positions,
  onClose,
}: {
  positions: AlpacaPosition[]
  onClose: (p: AlpacaPosition) => Promise<void>
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          <Th align="left">Sembol</Th>
          <Th>Miktar</Th>
          <Th>Giriş Fiyatı</Th>
          <Th>Güncel Fiyat</Th>
          <Th>K/Z</Th>
          <Th>K/Z %</Th>
          <Th>Piyasa Değeri</Th>
          <Th>Tarih</Th>
          <th className="w-8 px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {positions.map(p => {
          const pl    = parseFloat(p.unrealized_pl)
          const plPct = parseFloat(p.unrealized_plpc) * 100
          const isUp  = pl >= 0
          const plCls = isUp ? 'text-up' : 'text-down'
          return (
            <tr
              key={p.symbol}
              className="group/row border-b border-faint2 transition-colors duration-150 hover:bg-bg"
            >
              <td className="py-3 pl-3 pr-3">
                <div className="text-sm font-semibold text-ink">{p.symbol}</div>
                <div className="num text-[10px] text-mid">{p.exchange}</div>
              </td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">{p.qty}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">${fmtUsd(parseFloat(p.avg_entry_price))}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">
                {p.current_price ? `$${fmtUsd(parseFloat(p.current_price))}` : '—'}
              </td>
              <td className={`num px-3 py-3 text-right text-xs font-medium whitespace-nowrap ${plCls}`}>
                {pl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(pl))}
              </td>
              <td className={`num px-3 py-3 text-right text-xs font-medium whitespace-nowrap ${plCls}`}>
                {fmtPct(plPct)}
              </td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">${fmtUsd(parseFloat(p.market_value))}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap text-mid">
                {fmtDate(p.created_at)}
              </td>
              <td className="py-3 pl-2 pr-3">
                <RowActions
                  actions={[{
                    label: 'Pozisyonu Kapat',
                    destructive: true,
                    confirmMessage: `${p.symbol} pozisyonunu market fiyatından kapatmak istiyor musunuz?`,
                    confirmLabel: 'Kapat',
                    onExecute: () => onClose(p),
                  }]}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── closed positions table ───────────────────────────────────────────────────

function ClosedPositionsTable({ positions }: { positions: ClosedPaperPosition[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          <Th align="left">Sembol</Th>
          <Th>Miktar</Th>
          <Th>Giriş</Th>
          <Th>Çıkış</Th>
          <Th>K/Z</Th>
          <Th>K/Z %</Th>
          <Th>Kapanış Tarihi</Th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => {
          const isUp  = p.pl >= 0
          const plCls = isUp ? 'text-up' : 'text-down'
          return (
            <tr
              key={`${p.symbol}-${i}`}
              className="group/row border-b border-faint2 transition-colors duration-150 hover:bg-bg"
            >
              <td className="py-3 pl-3 pr-3 text-sm font-semibold text-ink">{p.symbol}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">{p.qty}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">${fmtUsd(p.entryPrice)}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">${fmtUsd(p.exitPrice)}</td>
              <td className={`num px-3 py-3 text-right text-xs font-medium whitespace-nowrap ${plCls}`}>
                {p.pl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(p.pl))}
              </td>
              <td className={`num px-3 py-3 text-right text-xs font-medium whitespace-nowrap ${plCls}`}>
                {fmtPct(p.plPct)}
              </td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap text-mid">
                {fmtDate(p.closedAt)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── orders table ─────────────────────────────────────────────────────────────

const ORDER_TYPE_LABEL: Record<string, string> = {
  limit:         'Limit',
  market:        'Market',
  stop:          'Stop',
  stop_limit:    'Stop-Limit',
  trailing_stop: 'Trailing Stop',
}

const ORDER_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  new:              { bg: '#eef3fb', color: '#2563a8' },
  partially_filled: { bg: '#fef8e9', color: '#9a6200' },
  accepted:         { bg: '#eef3fb', color: '#2563a8' },
  pending_new:      { bg: '#eef3fb', color: '#2563a8' },
}

function OrdersTable({
  orders,
  onCancel,
}: {
  orders: AlpacaOrder[]
  onCancel: (o: AlpacaOrder) => Promise<void>
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-faint bg-card">
          <Th align="left">Sembol</Th>
          <Th align="left">Tip</Th>
          <Th align="left">Yön</Th>
          <Th>Miktar</Th>
          <Th>Limit Fiyat</Th>
          <Th align="left">Durum</Th>
          <Th>Tarih</Th>
          <th className="w-8 px-2 py-2" />
        </tr>
      </thead>
      <tbody>
        {orders.map(o => {
          const statusStyle = ORDER_STATUS_STYLE[o.status] ?? { bg: '#f5f4f0', color: '#9a9a94' }
          const dateRaw     = o.submitted_at ?? o.created_at
          return (
            <tr
              key={o.id}
              className="group/row border-b border-faint2 transition-colors duration-150 hover:bg-bg"
            >
              <td className="py-3 pl-3 pr-3 text-sm font-semibold text-ink">{o.symbol}</td>
              <td className="num px-3 py-3 text-xs text-mid whitespace-nowrap">
                {ORDER_TYPE_LABEL[o.type] ?? o.type}
              </td>
              <td className="px-3 py-3">
                <span
                  className="num rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                  style={o.side === 'buy'
                    ? { background: '#edf5f2', color: '#1a7a5e' }
                    : { background: '#fdf0ee', color: '#c0392b' }}
                >
                  {o.side === 'buy' ? 'Alış' : 'Satış'}
                </span>
              </td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">{o.qty}</td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap">
                {o.limit_price ? `$${fmtUsd(parseFloat(o.limit_price))}` : '—'}
              </td>
              <td className="px-3 py-3">
                <span
                  className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: statusStyle.bg, color: statusStyle.color }}
                >
                  {o.status}
                </span>
              </td>
              <td className="num px-3 py-3 text-right text-xs whitespace-nowrap text-mid">
                {fmtDate(dateRaw)}
              </td>
              <td className="py-3 pl-2 pr-3">
                <RowActions
                  actions={[{
                    label: 'Emri İptal Et',
                    destructive: true,
                    confirmMessage: `${o.symbol} emrini iptal etmek istiyor musunuz?`,
                    confirmLabel: 'İptal Et',
                    onExecute: () => onCancel(o),
                  }]}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── main widget ──────────────────────────────────────────────────────────────

export function PaperTradingWidget() {
  const [tab, setTab]                   = useState<PaperTab>('positions')
  const [ordersVersion, setOrdersVersion] = useState(0)

  const { data: positions,      loading: posLoading,    error: posError } =
    useApi<AlpacaPosition[]>('/api/paper-trading/positions')

  const { data: closedPositions, loading: closedLoading } =
    useApi<ClosedPaperPosition[]>('/api/paper-trading/closed-positions')

  const { data: openOrders, loading: ordersLoading } =
    useApi<AlpacaOrder[]>(`/api/paper-trading/orders?status=open&_v=${ordersVersion}`)

  const unrealizedPl = (positions ?? []).reduce((s, p) => s + parseFloat(p.unrealized_pl), 0)
  const realizedPl   = (closedPositions ?? []).reduce((s, p) => s + p.pl, 0)
  const totalPl      = unrealizedPl + realizedPl
  const winCount     = (closedPositions ?? []).filter(p => p.pl > 0).length
  const lossCount    = (closedPositions ?? []).filter(p => p.pl < 0).length

  async function cancelOrder(o: AlpacaOrder) {
    const adminKey = localStorage.getItem('eqr:admin-key') ?? ''
    await fetch(`/api/paper-trading/orders/${o.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    })
    setOrdersVersion(v => v + 1)
  }

  async function closePosition(p: AlpacaPosition) {
    const adminKey = localStorage.getItem('eqr:admin-key') ?? ''
    await fetch('/api/paper-trading/orders', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: p.symbol,
        qty: String(Math.abs(parseFloat(p.qty))),
        side: 'sell',
        type: 'market',
        time_in_force: 'day',
      }),
    })
    setOrdersVersion(v => v + 1)
  }

  const totalPlClass = totalPl >= 0 ? 'text-up' : 'text-down'
  const totalPlSign  = totalPl >= 0 ? '+' : '−'

  const counts: Record<PaperTab, number> = {
    positions: positions?.length ?? 0,
    closed:    closedPositions?.length ?? 0,
    orders:    openOrders?.length ?? 0,
  }

  if (posError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-mid">Alpaca bağlantısı kurulamadı.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <KpiBar
        items={[
          {
            label: 'Toplam K/Z',
            value: `${totalPlSign}$${fmtUsd(Math.abs(totalPl))}`,
            colorClass: totalPlClass,
          },
          {
            label: 'Kazanan',
            value: closedPositions ? String(winCount) : '—',
            colorClass: 'text-up',
          },
          {
            label: 'Kaybeden',
            value: closedPositions ? String(lossCount) : '—',
            colorClass: 'text-down',
          },
          {
            label: 'Açık Pozisyon',
            value: positions ? String(positions.length) : '—',
          },
        ]}
      />

      <PaperTabs tab={tab} onChange={setTab} counts={counts} />

      {tab === 'positions' && (
        posLoading ? <Loading /> :
        !positions?.length ? <Empty>Açık pozisyon yok</Empty> :
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <ActivePositionsTable positions={positions} onClose={closePosition} />
        </div>
      )}

      {tab === 'closed' && (
        closedLoading ? <Loading /> :
        !closedPositions?.length ? <Empty>Henüz kapanmış işlem yok</Empty> :
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <ClosedPositionsTable positions={closedPositions} />
        </div>
      )}

      {tab === 'orders' && (
        ordersLoading ? <Loading /> :
        !openOrders?.length ? <Empty>Bekleyen emir yok</Empty> :
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <OrdersTable orders={openOrders} onCancel={cancelOrder} />
        </div>
      )}
    </div>
  )
}
