import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'

import type { PortfolioClosedPosition, PortfolioPosition, PortfolioSummary } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useMediaQuery } from '@/lib/use-media-query'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Select, type SelectOption } from '@/components/ui/select'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane } from './split'
import { Loading, Notice, UnderlineTabs } from './shared'
import {
  fmtMoney,
  fmtN,
  fmtPct,
  fmtQty,
  fmtSignedMoney,
  plColor,
  UNIT_FOR_TYPE,
} from './portfolio-calc'

/**
 * Below this width the eight-column table is replaced by cards.
 *
 * A phone showed Varlık, half of Adet and İşlem — Değer, K/Z and K/Z %, the
 * reason for opening the tab at all, were off-screen behind a horizontal
 * scroll, and the clipped Adet read as a wrong number (0,8099 shown as "0,8").
 */
const CARD_QUERY = '(max-width: 640px)'

const DAY_FMT = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** 'YYYY-MM-DD...' → '4 Eyl 2026'. Text-sliced, so no timezone round-trip. */
function fmtDay(stamp: string | null | undefined): string {
  if (!stamp) return '—'
  const [y, m, d] = stamp.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return DAY_FMT.format(new Date(y, m - 1, d))
}

type ListTab = 'open' | 'closed'

const LIST_TABS = [
  { id: 'open' as const, label: 'Açık' },
  { id: 'closed' as const, label: 'Kapanan' },
]

/** The Tür dropdown. Values match FormState['type'] and the DB's `type` column. */
const TYPE_OPTIONS: SelectOption<'stock' | 'us_stock' | 'fund'>[] = [
  { value: 'stock', label: 'BİST hissesi' },
  { value: 'us_stock', label: 'ABD hissesi' },
  { value: 'fund', label: 'Yatırım fonu' },
]

const TYPE_LABEL: Record<string, string> = {
  stock: 'BİST',
  us_stock: 'ABD',
  fund: 'Fon',
}

const TH =
  'bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 text-left font-medium whitespace-nowrap'

// ─── sorting ─────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

type OpenSortKey =
  | 'symbol'
  | 'quantity'
  | 'buyPrice'
  | 'currentPrice'
  | 'currentValue'
  | 'plAmount'
  | 'plPercent'

type ClosedSortKey = 'symbol' | 'quantity' | 'buyPrice' | 'sellPrice' | 'pl' | 'plPercent' | 'sellDate'

interface SortState<K extends string> {
  key: K
  dir: SortDir
}

/**
 * Sorts by the value `pick` returns. Text sorts with Turkish collation, so
 * İ/ı/ş/ğ land where a Turkish reader expects rather than after z.
 */
function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  pick: (row: T, key: K) => string | number | null,
): T[] {
  const factor = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = pick(a, sort.key)
    const vb = pick(b, sort.key)
    // Rows with no value (a price that never resolved) sink to the bottom in
    // both directions — they are missing data, not the smallest value.
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb), 'tr') * factor
    }
    return (va - vb) * factor
  })
}

function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = 'right',
  className = '',
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (key: K) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const active = sort.key === sortKey
  return (
    <th className={`${TH} ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-medium transition-colors ${
          align === 'right' ? 'justify-end' : 'justify-start'
        }`}
        style={{ color: active ? 'var(--ink)' : 'inherit', font: 'inherit' }}
        title={`${label} sütununa göre sırala`}
      >
        {label}
        <span aria-hidden className={active ? '' : 'opacity-0'}>
          {sort.dir === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  )
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Newest `last_updated` across all positions, rendered as "az önce" / "3 saat
 * önce" / "2 gün önce".
 *
 * This is the tell that matters most once the old app is retired: if the
 * refresh job ever stops, every number on the panel keeps looking authoritative
 * while quietly going stale. Showing the age makes that visible instead.
 */
function freshnessLabel(positions: PortfolioPosition[]): { text: string; stale: boolean } | null {
  const times = positions
    .map((p) => (p.lastUpdated ? Date.parse(p.lastUpdated) : NaN))
    .filter((t) => Number.isFinite(t))
  if (times.length === 0) return null

  const minutes = Math.round((Date.now() - Math.max(...times)) / 60_000)
  if (minutes < 2) return { text: 'az önce güncellendi', stale: false }
  if (minutes < 60) return { text: `${minutes} dk önce güncellendi`, stale: false }

  const hours = Math.round(minutes / 60)
  if (hours < 24) return { text: `${hours} saat önce güncellendi`, stale: hours >= 30 }

  const days = Math.round(hours / 24)
  // Prices refresh on weekday mornings, so a weekend gap is normal; past two
  // days something is actually wrong.
  return { text: `${days} gün önce güncellendi`, stale: days >= 2 }
}

// ─── login ───────────────────────────────────────────────────────────────────

function LoginForm() {
  const { login } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await login(username, password))
    setBusy(false)
  }

  return (
    <div className="flex justify-center pt-6">
      <form
        onSubmit={submit}
        className="bg-card border-faint w-full max-w-sm rounded-xl border p-6"
      >
        <h2 className="m-0 mb-1 text-[15px] font-medium tracking-[-0.25px]">Giriş</h2>
        <p className="text-mid mt-0 mb-5 text-xs leading-[1.6]">
          Portföyü görüntülemek ve değiştirmek için giriş yapın.
        </p>

        <Field label="Kullanıcı adı">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Parola">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="mb-3 text-xs leading-[1.6]" style={{ color: 'var(--down)' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Kontrol ediliyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  )
}

// ─── shared form bits ────────────────────────────────────────────────────────

const inputClass =
  'num border-faint bg-card text-ink focus:border-info w-full rounded-lg border px-2.5 py-1.5 text-[16px] outline-none sm:text-[13px]'

const primaryButtonClass =
  'w-full cursor-pointer rounded-lg border-0 px-3 py-3 text-[15px] font-medium transition-opacity hover:opacity-85 disabled:opacity-50 bg-[var(--ink)] text-[var(--card)] sm:py-2 sm:text-[13px]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="text-mid mb-1 block text-[12px]">{label}</span>
      {children}
    </label>
  )
}


// ─── new / edit position ─────────────────────────────────────────────────────

interface FormState {
  symbol: string
  name: string
  type: 'stock' | 'us_stock' | 'fund'
  quantity: string
  buyPrice: string
  buyDate: string
}

const EMPTY_FORM: FormState = {
  symbol: '',
  name: '',
  type: 'stock',
  quantity: '',
  buyPrice: '',
  buyDate: today(),
}

function PositionForm({
  position,
  onDone,
}: {
  /** null = create a new position; otherwise edit this one. */
  position: PortfolioPosition | null
  /** `pricePending` is true when a brand-new ticker has no price yet. */
  onDone: (pricePending?: boolean) => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setError(null)
    setForm(
      position
        ? {
            symbol: position.symbol,
            name: position.name ?? '',
            type: (position.type as FormState['type']) ?? 'stock',
            quantity: String(position.quantity),
            buyPrice: String(position.buyPrice),
            buyDate: position.buyDate.slice(0, 10),
          }
        : EMPTY_FORM,
    )
  }, [position])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const editing = position != null
    const res = await fetch(
      editing
        ? `/api/portfolio/manage/positions/${position.id}`
        : '/api/portfolio/manage/positions',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editing
            ? {
                name: form.name || null,
                quantity: form.quantity,
                buyPrice: form.buyPrice,
                buyDate: form.buyDate,
              }
            : { ...form, name: form.name || null },
        ),
      },
    )
    setBusy(false)
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { issues?: { message?: string }[] }
      const message = d.issues?.[0]?.message ?? 'Kaydedilemedi.'
      setError(message)
      toast.error(message)
      return
    }
    const created = editing ? null : ((await res.json().catch(() => null)) as { pricePending?: boolean } | null)
    if (editing) {
      toast.success(`${form.symbol} güncellendi`)
    } else if (created?.pricePending) {
      // A first-time ticker has to be added to the price sheet before
      // GOOGLEFINANCE can resolve it, which takes a few seconds.
      toast.info(`${form.symbol} eklendi — fiyatı birkaç saniye içinde gelecek`)
    } else {
      toast.success(`${form.symbol} portföye eklendi`)
    }
    onDone(created?.pricePending)
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Varlık kodu">
          <input
            value={form.symbol}
            onChange={set('symbol')}
            disabled={position != null}
            placeholder="AKBNK"
            className={`${inputClass} disabled:opacity-60`}
          />
        </Field>
        <Field label="Tür">
          <Select
            value={form.type}
            options={TYPE_OPTIONS}
            onChange={(type) => setForm((f) => ({ ...f, type }))}
            disabled={position != null}
            ariaLabel="Varlık türü"
          />
        </Field>
      </div>

      <Field label="Varlık adı (opsiyonel)">
        <input value={form.name} onChange={set('name')} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Adet">
          <input
            value={form.quantity}
            onChange={set('quantity')}
            placeholder="100"
            className={inputClass}
          />
        </Field>
        <Field label="Alış fiyatı">
          <input
            value={form.buyPrice}
            onChange={set('buyPrice')}
            placeholder="69,60"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Alış tarihi">
        <input type="date" value={form.buyDate} onChange={set('buyDate')} className={inputClass} />
      </Field>

      {form.type === 'us_stock' && !position && (
        <p className="text-mid mb-3 text-[12px] leading-[1.6]">
          USD/TRY kuru alış tarihine göre otomatik alınır.
        </p>
      )}

      {error && (
        <p className="mb-3 text-xs leading-[1.6]" style={{ color: 'var(--down)' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? 'Kaydediliyor…' : position ? 'Değişiklikleri kaydet' : 'Pozisyon ekle'}
      </button>
    </form>
  )
}

// ─── sell (full or partial) ──────────────────────────────────────────────────

function CloseForm({
  position,
  onDone,
}: {
  position: PortfolioPosition
  onDone: () => void
}) {
  const [quantity, setQuantity] = useState(String(position.quantity))
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setQuantity(String(position.quantity))
    setSellPrice('')
    setError(null)
  }, [position])

  const sold = Number(quantity.replace(',', '.'))
  const held = position.quantity
  const partial = Number.isFinite(sold) && sold > 0 && sold < held
  const unit = UNIT_FOR_TYPE[position.type] ?? ''

  // Live preview so the number is checked before it becomes a permanent record.
  const price = Number(sellPrice.replace(',', '.'))
  const preview =
    Number.isFinite(price) && price > 0 && Number.isFinite(sold) && sold > 0
      ? { pl: (price - position.buyPrice) * sold, pct: ((price - position.buyPrice) / position.buyPrice) * 100 }
      : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/portfolio/manage/positions/${position.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellPrice, sellDate, quantity }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as {
        message?: string
        issues?: { message?: string }[]
      }
      const message = d.message ?? d.issues?.[0]?.message ?? 'Satış kaydedilemedi.'
      setError(message)
      toast.error(message)
      return
    }
    toast.success(
      partial
        ? `${position.symbol}: ${fmtQty(sold)} adet satıldı, ${fmtQty(held - sold)} açık kaldı`
        : `${position.symbol} pozisyonu kapatıldı`,
    )
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label={`Satılan adet (elde ${fmtQty(held)})`}>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Satış fiyatı">
          <input
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            placeholder={fmtN(position.currentPrice, 2)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Satış tarihi">
        <input
          type="date"
          value={sellDate}
          onChange={(e) => setSellDate(e.target.value)}
          className={inputClass}
        />
      </Field>

      {partial && (
        <p className="text-mid mb-3 text-[12px] leading-[1.6]">
          Kısmi satış: {fmtQty(held - sold)} adet açık kalacak.
        </p>
      )}

      {preview && (
        <div className="border-faint2 mb-3 flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-mid text-[12px]">Gerçekleşecek K/Z</span>
          <span className="num text-[13px] font-semibold" style={{ color: plColor(preview.pl) }}>
            {fmtMoney(preview.pl, unit)} · {fmtPct(preview.pct)}
          </span>
        </div>
      )}

      {error && (
        <p className="mb-3 text-xs leading-[1.6]" style={{ color: 'var(--down)' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? 'Kaydediliyor…' : partial ? 'Kısmi satışı kaydet' : 'Pozisyonu kapat'}
      </button>
    </form>
  )
}

// ─── tab ─────────────────────────────────────────────────────────────────────

/** One label/value line in a sheet's detail list. */
function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border-faint2 flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="text-mid text-[12px]">{label}</span>
      <span
        className="num text-[14px] font-medium whitespace-nowrap"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * A position as a tappable card — the phone's replacement for a table row.
 *
 * Carries exactly what "checking the portfolio" needs (value and P/L); the
 * other six figures live one tap away, where there is room for them.
 */
function PositionCard({ p, onOpen }: { p: PortfolioPosition; onOpen: () => void }) {
  const unit = UNIT_FOR_TYPE[p.type] ?? ''
  return (
    <button
      onClick={onOpen}
      className="border-faint2 hover:bg-bg flex w-full cursor-pointer items-start justify-between gap-3 border-0 border-b bg-transparent px-4 py-3 text-left last:border-b-0"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{p.symbol}</span>
        <span className="text-mid mt-0.5 block text-[12px]">
          {TYPE_LABEL[p.type] ?? p.type}
          {p.name ? ` · ${p.name}` : ''}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-right">
          <span className="num block text-[15px] font-medium whitespace-nowrap">
            {fmtMoney(p.currentValue, unit, 0)}
          </span>
          <span
            className="num mt-0.5 block text-[12px] whitespace-nowrap"
            style={{ color: plColor(p.plAmount) }}
          >
            {fmtSignedMoney(p.plAmount, unit)} · {fmtPct(p.plPercent)}
          </span>
        </span>
        <ChevronRight className="text-faint size-4 shrink-0" aria-hidden="true" />
      </span>
    </button>
  )
}

function ClosedCard({
  c,
  onOpen,
}: {
  c: PortfolioClosedPosition
  onOpen: () => void
}) {
  const unit = UNIT_FOR_TYPE[c.type] ?? ''
  return (
    <button
      onClick={onOpen}
      className="border-faint2 hover:bg-bg flex w-full cursor-pointer items-start justify-between gap-3 border-0 border-b bg-transparent px-4 py-3 text-left last:border-b-0"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{c.symbol}</span>
        <span className="text-mid mt-0.5 block text-[12px]">
          {TYPE_LABEL[c.type] ?? c.type}
          {c.name ? ` · ${c.name}` : ''} · {fmtDay(c.sellDate)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-right">
          <span className="num block text-[15px] font-medium whitespace-nowrap">
            {fmtMoney(c.sellPrice * c.quantity, unit, 0)}
          </span>
          <span
            className="num mt-0.5 block text-[12px] whitespace-nowrap"
            style={{ color: plColor(c.pl) }}
          >
            {fmtSignedMoney(c.pl, unit)} · {fmtPct(c.plPercent)}
          </span>
        </span>
        <ChevronRight className="text-faint size-4 shrink-0" aria-hidden="true" />
      </span>
    </button>
  )
}

/** Pill segments — the phone stand-in for the panel's underline tabs. */
function SegTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (id: T) => void
  items: { id: T; label: string }[]
}) {
  return (
    <div className="bg-faint2 flex min-w-0 gap-1 rounded-full p-[3px]">
      {items.map((i) => {
        const on = i.id === value
        return (
          <button
            key={i.id}
            onClick={() => onChange(i.id)}
            className="cursor-pointer truncate rounded-full border-0 px-3.5 py-1.5 text-[13px] transition-colors"
            style={{
              background: on ? 'var(--card)' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--mid)',
              fontWeight: on ? 500 : 400,
            }}
          >
            {i.label}
          </button>
        )
      })}
    </div>
  )
}

/** Full-width action button inside a sheet footer — 48px, thumb-sized. */
function SheetAction({
  children,
  onClick,
  variant = 'ghost',
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const style: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--ink)', color: 'var(--card)', border: '1px solid var(--ink)' }
      : variant === 'danger'
        ? { border: '1px solid var(--down)', color: 'var(--down)' }
        : { border: '1px solid var(--faint)', color: 'var(--ink)' }
  return (
    <button
      onClick={onClick}
      className="h-12 w-full cursor-pointer rounded-[14px] bg-transparent text-[15px] font-medium transition-opacity hover:opacity-85"
      style={style}
    >
      {children}
    </button>
  )
}

type RightMode = 'new' | 'edit' | 'close'

/**
 * What the phone's bottom sheet is showing, or null for none.
 *
 * Deliberately separate from the desktop `mode`/`selectedId` pair: the two
 * layouts have different lifecycles (the desktop form panel is always on
 * screen, a sheet is not), and sharing one state made the sheet spring open on
 * load.
 */
type Sheet =
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'close'; id: string }
  | { kind: 'closed'; row: PortfolioClosedPosition }
  | { kind: 'new' }

export function VirtualPortfolioTab() {
  const { authenticated, loading: sessionLoading } = useSession()
  const toast = useToast()
  const confirm = useConfirm()

  const cards = useMediaQuery(CARD_QUERY)
  const [sheet, setSheet] = useState<Sheet | null>(null)

  const [tab, setTab] = useState<ListTab>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<RightMode>('new')
  const [version, setVersion] = useState(0)

  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [closed, setClosed] = useState<PortfolioClosedPosition[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [openSort, setOpenSort] = useState<SortState<OpenSortKey>>({ key: 'symbol', dir: 'asc' })
  const [closedSort, setClosedSort] = useState<SortState<ClosedSortKey>>({
    key: 'sellDate',
    dir: 'desc',
  })

  /**
   * Same column toggles direction; a new column starts in the direction that is
   * useful for its type — names A→Z, numbers biggest first.
   */
  function sortOpen(key: OpenSortKey) {
    setOpenSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' },
    )
  }

  function sortClosed(key: ClosedSortKey) {
    setClosedSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'symbol' ? 'asc' : 'desc' },
    )
  }

  // Rotating to landscape swaps the card list for the table; a sheet left open
  // would then hover over a layout it does not belong to.
  useEffect(() => {
    if (!cards) setSheet(null)
  }, [cards])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!authenticated) return
    let cancelled = false
    Promise.all([
      fetch('/api/portfolio/summary').then((r) => r.json()),
      fetch('/api/portfolio/closed').then((r) => r.json()),
    ])
      .then(([s, c]) => {
        if (cancelled) return
        setSummary(s as PortfolioSummary)
        setClosed(c as PortfolioClosedPosition[])
      })
      .catch(() => !cancelled && setError('Portföy verisi alınamadı.'))
    return () => {
      cancelled = true
    }
  }, [authenticated, version])

  if (sessionLoading) return <Loading />
  if (!authenticated) {
    return (
      <div>
        <TabHeading
          title="Sanal Portföy"
          subtitle="Pozisyonlarını buradan ekle, düzenle ve kapat."
        />
        <LoginForm />
      </div>
    )
  }
  if (error) return <Notice>{error}</Notice>

  const positions = summary?.positions ?? []
  const selected = positions.find((p) => p.id === selectedId) ?? null
  const freshness = freshnessLabel(positions)

  const sortedPositions = sortRows(positions, openSort, (p, k) =>
    k === 'symbol' ? p.symbol : (p[k] as number | null),
  )
  const sortedClosed = sortRows(closed ?? [], closedSort, (c, k) =>
    k === 'symbol' || k === 'sellDate' ? c[k] : (c[k] as number | null),
  )

  async function refreshPrices() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/portfolio/manage/prices/refresh', { method: 'POST' })
      if (!res.ok) throw new Error()
      const r = (await res.json()) as {
        updated: { symbol: string }[]
        skipped: { symbol: string; reason: string }[]
        sourceError?: string
      }
      // The source being down is a different failure from a symbol missing from
      // the sheet. Listing 17 tickers when Google is unreachable blames the
      // wrong thing and sends you looking in the wrong place.
      if (r.sourceError) {
        toast.error('Fiyat kaynağına ulaşılamadı — mevcut fiyatlar korundu.')
        return
      }
      toast.success(`${r.updated.length} hisse fiyatı güncellendi`)
      if (r.skipped.length) {
        toast.error(`Sheet'te bulunamadı: ${r.skipped.map((s) => s.symbol).join(', ')}`)
      }
      reload()
    } catch {
      toast.error('Fiyatlar yenilenemedi.')
    } finally {
      setRefreshing(false)
    }
  }

  function afterWrite(pricePending?: boolean) {
    setSelectedId(null)
    setMode('new')
    setSheet(null)
    reload()
    // The server keeps retrying a new ticker's price in the background; poll so
    // it appears without the user pressing anything. Spaced for a sheet that
    // needs tens of seconds per read — the old 6/18/35s all fired before the
    // first successful read could possibly have happened.
    if (pricePending) {
      for (const ms of [8_000, 25_000, 60_000, 120_000, 200_000]) {
        window.setTimeout(reload, ms)
      }
    }
  }

  async function remove(p: PortfolioPosition) {
    const ok = await confirm({
      title: `${p.symbol} pozisyonu silinsin mi?`,
      body: (
        <>
          Bu bir <strong>satış kaydı oluşturmaz</strong> — pozisyon geçmişte de görünmez ve
          işlem geri alınamaz. Satış yapmak istiyorsanız “Sat” kullanın.
        </>
      ),
      confirmLabel: 'Sil',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/portfolio/manage/positions/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`${p.symbol} portföyden silindi`)
      afterWrite()
    } else {
      toast.error(`${p.symbol} silinemedi.`)
    }
  }

  async function removeClosed(c: PortfolioClosedPosition & { id?: string }) {
    if (!c.id) return
    const ok = await confirm({
      title: `${c.symbol} satış kaydı silinsin mi?`,
      body: 'Bu kayıt geçmişten kalkar ve gerçekleşen kâr/zarar toplamından düşer. Geri alınamaz.',
      confirmLabel: 'Sil',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/portfolio/manage/closed-positions/${c.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`${c.symbol} satış kaydı silindi`)
      reload()
    } else {
      toast.error(`${c.symbol} kaydı silinemedi.`)
    }
  }

  const listPanel = (
    <Panel
      side="a"
      title="Pozisyonlar"
      right={<Chip>{tab === 'open' ? `${positions.length} açık` : `${closed?.length ?? 0} kayıt`}</Chip>}
      belowHeader={<UnderlineTabs items={LIST_TABS} value={tab} onChange={setTab} />}
      padded={false}
      maxBodyHeight="70vh"
    >
      {!summary ? (
        <Loading />
      ) : tab === 'open' ? (
        positions.length === 0 ? (
          <PanelEmpty>Açık pozisyon yok. Sağdaki formdan ekleyin.</PanelEmpty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <SortableTh label="Varlık" sortKey="symbol" sort={openSort} onSort={sortOpen} align="left" className="eqr-pin-l pr-3 pl-[18px]" />
                <SortableTh label="Adet" sortKey="quantity" sort={openSort} onSort={sortOpen} className="px-2" />
                <SortableTh label="Alış" sortKey="buyPrice" sort={openSort} onSort={sortOpen} className="px-2" />
                <SortableTh label="Güncel" sortKey="currentPrice" sort={openSort} onSort={sortOpen} className="px-2" />
                <SortableTh label="Değer" sortKey="currentValue" sort={openSort} onSort={sortOpen} className="px-2" />
                <SortableTh label="K/Z" sortKey="plAmount" sort={openSort} onSort={sortOpen} className="px-2" />
                <SortableTh label="K/Z %" sortKey="plPercent" sort={openSort} onSort={sortOpen} className="px-2" />
                <th className={`${TH} eqr-pin-r pr-[18px] pl-2 text-right`}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sortedPositions.map((p) => {
                const unit = UNIT_FOR_TYPE[p.type] ?? ''
                return (
                  <tr
                    key={p.id}
                    data-selected={selectedId === p.id}
                    className="border-faint2 hover:bg-bg border-b"
                    style={{ background: selectedId === p.id ? 'var(--bg)' : 'var(--card)' }}
                  >
                    <td className="eqr-pin-l pr-3 pl-[18px]">
                      <div className="text-[13px] font-semibold">{p.symbol}</div>
                      <div className="text-mid text-[12px]">
                        {TYPE_LABEL[p.type] ?? p.type}
                        {p.name ? ` · ${p.name}` : ''}
                      </div>
                    </td>
                    <td className="num px-2 text-right whitespace-nowrap">{fmtQty(p.quantity)}</td>
                    <td className="num px-2 text-right whitespace-nowrap">
                      {fmtMoney(p.buyPrice, unit)}
                    </td>
                    <td className="num px-2 text-right whitespace-nowrap">
                      {fmtMoney(p.currentPrice, unit)}
                    </td>
                    <td className="num px-2 text-right whitespace-nowrap">
                      {fmtMoney(p.currentValue, unit, 0)}
                    </td>
                    <td
                      className="num px-2 text-right font-medium whitespace-nowrap"
                      style={{ color: plColor(p.plAmount) }}
                    >
                      {fmtSignedMoney(p.plAmount, unit)}
                    </td>
                    <td
                      className="num px-2 text-right whitespace-nowrap"
                      style={{ color: plColor(p.plPercent) }}
                    >
                      {fmtPct(p.plPercent)}
                    </td>
                    <td className="eqr-pin-r pr-[18px] pl-2">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <RowButton
                          onClick={() => {
                            setSelectedId(p.id)
                            setMode('edit')
                          }}
                        >
                          Düzenle
                        </RowButton>
                        <RowButton
                          onClick={() => {
                            setSelectedId(p.id)
                            setMode('close')
                          }}
                        >
                          Sat
                        </RowButton>
                        <RowButton onClick={() => remove(p)} danger>
                          Sil
                        </RowButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      ) : !closed?.length ? (
        <PanelEmpty>Kapanan pozisyon yok.</PanelEmpty>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <SortableTh label="Varlık" sortKey="symbol" sort={closedSort} onSort={sortClosed} align="left" className="eqr-pin-l pr-3 pl-[18px]" />
              <SortableTh label="Adet" sortKey="quantity" sort={closedSort} onSort={sortClosed} className="px-2" />
              <SortableTh label="Alış" sortKey="buyPrice" sort={closedSort} onSort={sortClosed} className="px-2" />
              <SortableTh label="Satış" sortKey="sellPrice" sort={closedSort} onSort={sortClosed} className="px-2" />
              <SortableTh label="K/Z" sortKey="pl" sort={closedSort} onSort={sortClosed} className="px-2" />
              <SortableTh label="K/Z %" sortKey="plPercent" sort={closedSort} onSort={sortClosed} className="px-2" />
              <SortableTh label="Tarih" sortKey="sellDate" sort={closedSort} onSort={sortClosed} className="px-2" />
              <th className={`${TH} eqr-pin-r pr-[18px] pl-2 text-right`}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sortedClosed.map((c) => {
              const unit = UNIT_FOR_TYPE[c.type] ?? ''
              return (
              <tr key={c.id} className="border-faint2 hover:bg-bg border-b" style={{ background: 'var(--card)' }}>
                <td className="eqr-pin-l pr-3 pl-[18px]">
                  <div className="text-[13px] font-semibold">{c.symbol}</div>
                  <div className="text-mid text-[12px]">
                    {TYPE_LABEL[c.type] ?? c.type}
                    {c.name ? ` · ${c.name}` : ''}
                  </div>
                </td>
                <td className="num px-2 text-right whitespace-nowrap">{fmtQty(c.quantity)}</td>
                <td className="num px-2 text-right whitespace-nowrap">{fmtMoney(c.buyPrice, unit)}</td>
                <td className="num px-2 text-right whitespace-nowrap">{fmtMoney(c.sellPrice, unit)}</td>
                <td
                  className="num px-2 text-right font-medium whitespace-nowrap"
                  style={{ color: plColor(c.pl) }}
                >
                  {fmtSignedMoney(c.pl, unit)}
                </td>
                <td
                  className="num px-2 text-right whitespace-nowrap"
                  style={{ color: plColor(c.pl) }}
                >
                  {fmtPct(c.plPercent)}
                </td>
                <td className="num text-mid px-2 text-right whitespace-nowrap">
                  {c.sellDate.slice(0, 10)}
                </td>
                <td className="eqr-pin-r pr-[18px] pl-2">
                  <div className="flex justify-end">
                    <RowButton onClick={() => removeClosed(c)} danger>
                      Sil
                    </RowButton>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Panel>
  )

  const formPanel = (
    <Panel
      side="b"
      title={
        mode === 'close' && selected
          ? `${selected.symbol} — sat`
          : mode === 'edit' && selected
            ? `${selected.symbol} — düzenle`
            : 'Yeni pozisyon'
      }
      right={
        selected ? (
          <button
            onClick={() => {
              setSelectedId(null)
              setMode('new')
            }}
            aria-label="Formu kapat"
            className="text-mid hover:text-ink cursor-pointer border-0 bg-transparent p-[3px] text-base leading-none"
          >
            ×
          </button>
        ) : undefined
      }
    >
      {mode === 'close' && selected ? (
        <CloseForm position={selected} onDone={afterWrite} />
      ) : (
        <PositionForm position={mode === 'edit' ? selected : null} onDone={afterWrite} />
      )}
    </Panel>
  )

  // ── phone layout ────────────────────────────────────────────────────────
  const sheetPos =
    sheet && sheet.kind !== 'new' && sheet.kind !== 'closed'
      ? (positions.find((p) => p.id === sheet.id) ?? null)
      : null

  const sheetTitle =
    sheet?.kind === 'new'
      ? 'Yeni pozisyon'
      : sheet?.kind === 'closed'
        ? `${sheet.row.symbol} — satış`
        : sheetPos
          ? sheet?.kind === 'edit'
            ? `${sheetPos.symbol} — düzenle`
            : sheet?.kind === 'close'
              ? `${sheetPos.symbol} — sat`
              : sheetPos.symbol
          : ''

  let sheetBody: React.ReactNode = null
  let sheetFooter: React.ReactNode = undefined

  if (sheet?.kind === 'new' || sheet?.kind === 'edit') {
    sheetBody = (
      <PositionForm position={sheet.kind === 'edit' ? sheetPos : null} onDone={afterWrite} />
    )
  } else if (sheet?.kind === 'close' && sheetPos) {
    sheetBody = <CloseForm position={sheetPos} onDone={afterWrite} />
  } else if (sheet?.kind === 'detail' && sheetPos) {
    const unit = UNIT_FOR_TYPE[sheetPos.type] ?? ''
    sheetBody = (
      <>
        <p className="text-mid mt-0 mb-2 text-[12px]">
          {TYPE_LABEL[sheetPos.type] ?? sheetPos.type}
          {sheetPos.name ? ` · ${sheetPos.name}` : ''}
        </p>
        <DetailRow label="Adet" value={fmtQty(sheetPos.quantity)} />
        <DetailRow label="Değer" value={fmtMoney(sheetPos.currentValue, unit, 0)} />
        <DetailRow label="Alış fiyatı" value={fmtMoney(sheetPos.buyPrice, unit)} />
        <DetailRow label="Güncel fiyat" value={fmtMoney(sheetPos.currentPrice, unit)} />
        <DetailRow
          label="K/Z"
          value={fmtSignedMoney(sheetPos.plAmount, unit)}
          color={plColor(sheetPos.plAmount)}
        />
        <DetailRow
          label="K/Z %"
          value={fmtPct(sheetPos.plPercent)}
          color={plColor(sheetPos.plPercent)}
        />
        <DetailRow label="Alış tarihi" value={fmtDay(sheetPos.buyDate)} />
        {sheetPos.buyRate != null && (
          <DetailRow label="Alış kuru" value={fmtN(sheetPos.buyRate)} />
        )}
      </>
    )
    sheetFooter = (
      <div className="flex flex-col gap-2">
        <SheetAction variant="primary" onClick={() => setSheet({ kind: 'close', id: sheetPos.id })}>
          Sat
        </SheetAction>
        <SheetAction onClick={() => setSheet({ kind: 'edit', id: sheetPos.id })}>
          Düzenle
        </SheetAction>
        <SheetAction variant="danger" onClick={() => remove(sheetPos)}>
          Sil
        </SheetAction>
      </div>
    )
  } else if (sheet?.kind === 'closed') {
    const c = sheet.row
    const unit = UNIT_FOR_TYPE[c.type] ?? ''
    sheetBody = (
      <>
        <p className="text-mid mt-0 mb-2 text-[12px]">
          {TYPE_LABEL[c.type] ?? c.type}
          {c.name ? ` · ${c.name}` : ''}
        </p>
        <DetailRow label="Adet" value={fmtQty(c.quantity)} />
        <DetailRow label="Alış fiyatı" value={fmtMoney(c.buyPrice, unit)} />
        <DetailRow label="Satış fiyatı" value={fmtMoney(c.sellPrice, unit)} />
        <DetailRow label="K/Z" value={fmtSignedMoney(c.pl, unit)} color={plColor(c.pl)} />
        <DetailRow label="K/Z %" value={fmtPct(c.plPercent)} color={plColor(c.pl)} />
        <DetailRow label="Alış tarihi" value={fmtDay(c.buyDate)} />
        <DetailRow label="Satış tarihi" value={fmtDay(c.sellDate)} />
      </>
    )
    sheetFooter = (
      <SheetAction variant="danger" onClick={() => removeClosed(c)}>
        Satış kaydını sil
      </SheetAction>
    )
  }

  const mobileBody = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SegTabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'open' as const, label: `Açık ${positions.length}` },
            { id: 'closed' as const, label: `Kapanan ${closed?.length ?? 0}` },
          ]}
        />
        <button
          onClick={() => setSheet({ kind: 'new' })}
          aria-label="Pozisyon ekle"
          className="flex h-[38px] w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0"
          style={{ background: 'var(--ink)', color: 'var(--card)' }}
        >
          <Plus className="size-[18px]" />
        </button>
      </div>

      <div className="bg-card border-faint overflow-hidden rounded-xl border">
        {!summary ? (
          <Loading />
        ) : tab === 'open' ? (
          positions.length === 0 ? (
            <PanelEmpty>Açık pozisyon yok. Yukarıdaki + ile ekleyin.</PanelEmpty>
          ) : (
            sortedPositions.map((p) => (
              <PositionCard key={p.id} p={p} onOpen={() => setSheet({ kind: 'detail', id: p.id })} />
            ))
          )
        ) : !closed?.length ? (
          <PanelEmpty>Kapanan pozisyon yok.</PanelEmpty>
        ) : (
          sortedClosed.map((c) => (
            <ClosedCard key={c.id} c={c} onOpen={() => setSheet({ kind: 'closed', row: c })} />
          ))
        )}
      </div>

      <BottomSheet open={sheet !== null} title={sheetTitle} onClose={() => setSheet(null)} footer={sheetFooter}>
        {sheetBody}
      </BottomSheet>
    </>
  )

  return (
    <div>
      <TabHeading
        title="Sanal Portföy"
        subtitle="Pozisyonlarını buradan ekle, düzenle ve kapat."
        right={
          // Full width on a phone so freshness and the refresh button read as
          // one row rather than a ragged right-aligned block under the title.
          <div className="flex w-full items-center justify-between gap-2.5 sm:w-auto sm:justify-end">
            {freshness && (
              <span
                className="num text-[12px]"
                style={{ color: freshness.stale ? 'var(--warn)' : 'var(--mid)' }}
                title="Hisseler 15 dakikada bir, fonlar hafta içi 09:00 ve 10:00'da yenilenir"
              >
                {freshness.stale ? '⚠ ' : ''}
                {freshness.text}
              </span>
            )}
            <button
              onClick={refreshPrices}
              disabled={refreshing}
              title="Fon fiyatı günde bir değişir; sabah otomatik çekilir, burada yenilenmez."
              className="border-faint hover:bg-faint2 text-mid cursor-pointer rounded-lg border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50"
            >
              {refreshing ? 'Yenileniyor…' : 'Hisse fiyatlarını yenile'}
            </button>
          </div>
        }
      />
      {cards ? mobileBody : <SplitPane splitKey="virtual" a={listPanel} b={formPanel} />}
    </div>
  )
}

function RowButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="border-faint hover:bg-faint2 cursor-pointer rounded-md border px-2 py-1 text-[12px] transition-colors"
      style={{ color: danger ? 'var(--down)' : 'var(--mid)' }}
    >
      {children}
    </button>
  )
}
