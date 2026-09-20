import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Loader2, MoreHorizontal } from 'lucide-react'

import { useApi } from '@/lib/use-api'
import { scrollTabIntoView } from '@/lib/scroll-tab-into-view'
import { Skeleton, SkeletonCards, SkeletonRows } from '@/components/ui/skeleton'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useConfirm } from '@/lib/confirm'
import { useMediaQuery } from '@/lib/use-media-query'
import { PHONE_QUERY } from '@/features/workspace/split'

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
    /* Two per row on a phone: four across a 375px screen left ~80px each and
       the labels truncated to "TOP…", "KAZ…". The hairlines come from the grid
       gap over a tinted background, since divide-x only draws between columns. */
    <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-faint2 bg-faint2 sm:flex sm:gap-0 sm:divide-x sm:divide-faint2 sm:bg-transparent">
      {items.map(({ label, value, colorClass = 'text-ink' }, i) => (
        <div key={i} className="bg-card min-w-0 flex-1 px-4 py-2.5">
          <p className="mb-1 truncate text-[12px] leading-none text-mid">
            {label}
          </p>
          <p className={`num flex h-[19px] items-center text-base font-semibold ${colorClass}`}>
            {value}
          </p>
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
  /** null until that list has answered — "(0)" is a count we don't have yet. */
  counts: Record<PaperTab, number | null>
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Partial<Record<PaperTab, HTMLButtonElement | null>>>({})

  // Keep the selected tab fully visible: the strip overflows on a phone and the
  // last tab was landing half-cut against the right edge.
  useEffect(() => {
    scrollTabIntoView(stripRef.current, itemRefs.current[tab] ?? null)
  }, [tab])

  return (
    /* Scrolls instead of pushing the page: four labels came to 443px against a
       375px screen, and the overflow was the document's, so every screen in the
       tab scrolled sideways. */
    <div ref={stripRef} className="eqr-hscroll mb-3 flex gap-3 overflow-x-auto border-b border-faint">
      {TAB_DEFS.map(({ key, label }) => (
        <button
          key={key}
          ref={(el) => {
            itemRefs.current[key] = el
          }}
          onClick={() => onChange(key)}
          className={[
            '-mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap',
            tab === key
              ? 'border-info text-info'
              : 'border-transparent text-mid hover:text-ink',
          ].join(' ')}
        >
          {label}
          {counts[key] != null && ` (${counts[key]})`}
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


// ─── phone: cards + sheet ─────────────────────────────────────────────────────
//
// Eight columns measured 722px against a 375px screen, so the phone showed
// Sembol, Miktar and half of Giriş — while K/Z, the reason for opening the tab,
// and the row's "⋯" menu (the only way to close a position) sat off-screen.
// Same shape as the Sanal Portföy cards: the number you came for on the right,
// the detail one tap away.

function CardRow({
  title,
  sub,
  right,
  rightSub,
  rightClass = '',
  onOpen,
}: {
  title: React.ReactNode
  sub: React.ReactNode
  right: React.ReactNode
  rightSub?: React.ReactNode
  rightClass?: string
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full cursor-pointer items-start justify-between gap-3 border-0 border-b border-faint2 bg-transparent px-4 py-3 text-left last:border-b-0 hover:bg-bg"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{title}</span>
        <span className="num mt-0.5 block text-[12px] text-mid">{sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-right">
          <span className={`num block text-[14px] font-medium whitespace-nowrap ${rightClass}`}>
            {right}
          </span>
          {rightSub && (
            <span className={`num mt-0.5 block text-[12px] whitespace-nowrap ${rightClass}`}>
              {rightSub}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden="true" />
      </span>
    </button>
  )
}

/** One field of the sheet — label left, value right. */
function SheetRow({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-faint2 py-2.5 last:border-b-0">
      <span className="text-[12px] text-mid">{label}</span>
      <span className={`num text-[13px] ${className}`}>{value}</span>
    </div>
  )
}

// ─── th helper ────────────────────────────────────────────────────────────────

function Th({ children, align = 'right' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={[
        'px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-mid whitespace-nowrap',
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
                <div className="num text-[12px] text-mid">{p.exchange}</div>
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
  new:              { bg: 'var(--info-tint)', color: 'var(--info)' },
  partially_filled: { bg: 'var(--warn-tint)', color: 'var(--warn)' },
  accepted:         { bg: 'var(--info-tint)', color: 'var(--info)' },
  pending_new:      { bg: 'var(--info-tint)', color: 'var(--info)' },
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
          const statusStyle = ORDER_STATUS_STYLE[o.status] ?? { bg: 'var(--neutral-tint)', color: 'var(--mid)' }
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
                    ? { background: 'var(--up-tint)', color: 'var(--up)' }
                    : { background: 'var(--down-tint)', color: 'var(--down)' }}
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
  const phone = useMediaQuery(PHONE_QUERY)
  const confirm = useConfirm()
  const [sheet, setSheet] = useState<
    | { kind: 'position'; row: AlpacaPosition }
    | { kind: 'closed'; row: ClosedPaperPosition }
    | { kind: 'order'; row: AlpacaOrder }
    | null
  >(null)

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

  const counts: Record<PaperTab, number | null> = {
    positions: positions?.length ?? null,
    closed:    closedPositions?.length ?? null,
    orders:    openOrders?.length ?? null,
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
            label: 'Toplam k/z',
            // Blocks while the account loads: computed from empty arrays the
            // total rendered as "+$0.00", a real-looking figure for an account
            // that had not answered yet.
            value:
              posLoading || closedLoading ? (
                <Skeleton h={16} w={86} />
              ) : (
                `${totalPlSign}$${fmtUsd(Math.abs(totalPl))}`
              ),
            colorClass: totalPlClass,
          },
          {
            label: 'Kazanan',
            value: closedLoading ? <Skeleton h={16} w={26} /> : String(winCount),
            colorClass: 'text-up',
          },
          {
            label: 'Kaybeden',
            value: closedLoading ? <Skeleton h={16} w={26} /> : String(lossCount),
            colorClass: 'text-down',
          },
          {
            label: 'Açık pozisyon',
            value: posLoading ? <Skeleton h={16} w={26} /> : String(positions?.length ?? 0),
          },
        ]}
      />

      <PaperTabs tab={tab} onChange={setTab} counts={counts} />

      {tab === 'positions' && (
        posLoading ? (phone ? <SkeletonCards rows={5} /> : <SkeletonRows rows={5} cols={4} />) :
        !positions?.length ? <Empty>Açık pozisyon yok</Empty> :
        phone ? (
          <div className="-mx-4">
            {positions.map(p => {
              const pl = parseFloat(p.unrealized_pl)
              return (
                <CardRow
                  key={p.symbol}
                  title={<>{p.symbol} <span className="text-[12px] font-normal text-mid">{p.exchange}</span></>}
                  sub={`${p.qty} adet · $${fmtUsd(parseFloat(p.avg_entry_price))} → ${p.current_price ? `$${fmtUsd(parseFloat(p.current_price))}` : '—'}`}
                  right={`${pl >= 0 ? '+' : '−'}$${fmtUsd(Math.abs(pl))}`}
                  rightSub={fmtPct(parseFloat(p.unrealized_plpc) * 100)}
                  rightClass={pl >= 0 ? 'text-up' : 'text-down'}
                  onOpen={() => setSheet({ kind: 'position', row: p })}
                />
              )
            })}
          </div>
        ) : (
          <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
            <ActivePositionsTable positions={positions} onClose={closePosition} />
          </div>
        )
      )}

      {tab === 'closed' && (
        closedLoading ? (phone ? <SkeletonCards rows={5} /> : <SkeletonRows rows={5} cols={4} />) :
        !closedPositions?.length ? <Empty>Henüz kapanmış işlem yok</Empty> :
        phone ? (
          <div className="-mx-4">
            {closedPositions.map((c, i) => (
              <CardRow
                key={`${c.symbol}-${i}`}
                title={c.symbol}
                sub={`${c.qty} adet · $${fmtUsd(c.entryPrice)} → $${fmtUsd(c.exitPrice)}`}
                right={`${c.pl >= 0 ? '+' : '−'}$${fmtUsd(Math.abs(c.pl))}`}
                rightSub={fmtPct(c.plPct)}
                rightClass={c.pl >= 0 ? 'text-up' : 'text-down'}
                onOpen={() => setSheet({ kind: 'closed', row: c })}
              />
            ))}
          </div>
        ) : (
          <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
            <ClosedPositionsTable positions={closedPositions} />
          </div>
        )
      )}

      {tab === 'orders' && (
        ordersLoading ? (phone ? <SkeletonCards rows={4} /> : <SkeletonRows rows={5} cols={4} />) :
        !openOrders?.length ? <Empty>Bekleyen emir yok</Empty> :
        phone ? (
          <div className="-mx-4">
            {openOrders.map(o => (
              <CardRow
                key={o.id}
                title={<>{o.symbol} <span className="text-[12px] font-normal text-mid">{o.side === 'buy' ? 'alış' : 'satış'}</span></>}
                sub={`${ORDER_TYPE_LABEL[o.type] ?? o.type} · ${o.qty} adet`}
                right={o.limit_price ? `$${fmtUsd(parseFloat(o.limit_price))}` : '—'}
                rightSub={o.status}
                onOpen={() => setSheet({ kind: 'order', row: o })}
              />
            ))}
          </div>
        ) : (
          <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
            <OrdersTable orders={openOrders} onCancel={cancelOrder} />
          </div>
        )
      )}

      {phone && sheet && (
        <BottomSheet
          open
          title={
            <span className="flex items-baseline gap-2">
              {sheet.row.symbol}
              {sheet.kind === 'position' && (
                <span className="num text-[12px] font-normal text-mid">{sheet.row.exchange}</span>
              )}
            </span>
          }
          onClose={() => setSheet(null)}
          footer={
            sheet.kind === 'position' ? (
              <button
                onClick={async () => {
                  const row = sheet.row
                  // The panel's own modal, not window.confirm — see GÖREV 28.
                  const ok = await confirm({
                    title: 'Pozisyon kapatılsın mı?',
                    body: `${row.symbol} pozisyonu market fiyatından kapatılacak.`,
                    confirmLabel: 'Kapat',
                    danger: true,
                  })
                  if (!ok) return
                  setSheet(null)
                  await closePosition(row)
                }}
                className="w-full cursor-pointer rounded-xl border px-3 py-2.5 text-[13px] font-medium"
                style={{ borderColor: 'var(--down)', color: 'var(--down)', background: 'var(--down-tint)' }}
              >
                Pozisyonu kapat
              </button>
            ) : sheet.kind === 'order' ? (
              <button
                onClick={async () => {
                  const row = sheet.row
                  const ok = await confirm({
                    title: 'Emir iptal edilsin mi?',
                    body: `${row.symbol} için bekleyen emir iptal edilecek.`,
                    confirmLabel: 'İptal et',
                    danger: true,
                  })
                  if (!ok) return
                  setSheet(null)
                  await cancelOrder(row)
                }}
                className="w-full cursor-pointer rounded-xl border px-3 py-2.5 text-[13px] font-medium"
                style={{ borderColor: 'var(--down)', color: 'var(--down)', background: 'var(--down-tint)' }}
              >
                Emri iptal et
              </button>
            ) : undefined
          }
        >
          {sheet.kind === 'position' && (
            <>
              <SheetRow label="Miktar" value={sheet.row.qty} />
              <SheetRow label="Giriş fiyatı" value={`$${fmtUsd(parseFloat(sheet.row.avg_entry_price))}`} />
              <SheetRow
                label="Güncel fiyat"
                value={sheet.row.current_price ? `$${fmtUsd(parseFloat(sheet.row.current_price))}` : '—'}
              />
              <SheetRow
                label="K/Z"
                value={`${parseFloat(sheet.row.unrealized_pl) >= 0 ? '+' : '−'}$${fmtUsd(Math.abs(parseFloat(sheet.row.unrealized_pl)))} · ${fmtPct(parseFloat(sheet.row.unrealized_plpc) * 100)}`}
                className={parseFloat(sheet.row.unrealized_pl) >= 0 ? 'text-up' : 'text-down'}
              />
              <SheetRow label="Piyasa değeri" value={`$${fmtUsd(parseFloat(sheet.row.market_value))}`} />
              <SheetRow label="Açılış" value={fmtDate(sheet.row.created_at)} />
            </>
          )}
          {sheet.kind === 'closed' && (
            <>
              <SheetRow label="Miktar" value={sheet.row.qty} />
              <SheetRow label="Giriş" value={`$${fmtUsd(sheet.row.entryPrice)}`} />
              <SheetRow label="Çıkış" value={`$${fmtUsd(sheet.row.exitPrice)}`} />
              <SheetRow
                label="K/Z"
                value={`${sheet.row.pl >= 0 ? '+' : '−'}$${fmtUsd(Math.abs(sheet.row.pl))} · ${fmtPct(sheet.row.plPct)}`}
                className={sheet.row.pl >= 0 ? 'text-up' : 'text-down'}
              />
              <SheetRow label="Kapanış tarihi" value={fmtDate(sheet.row.closedAt)} />
            </>
          )}
          {sheet.kind === 'order' && (
            <>
              <SheetRow label="Yön" value={sheet.row.side === 'buy' ? 'Alış' : 'Satış'} />
              <SheetRow label="Tip" value={ORDER_TYPE_LABEL[sheet.row.type] ?? sheet.row.type} />
              <SheetRow label="Miktar" value={sheet.row.qty} />
              <SheetRow
                label="Limit fiyat"
                value={sheet.row.limit_price ? `$${fmtUsd(parseFloat(sheet.row.limit_price))}` : '—'}
              />
              <SheetRow label="Durum" value={sheet.row.status} />
              <SheetRow label="Tarih" value={fmtDate(sheet.row.submitted_at ?? sheet.row.created_at)} />
            </>
          )}
        </BottomSheet>
      )}
    </div>
  )
}
