import { useCallback, useEffect, useState } from 'react'

import type { PortfolioClosedPosition, PortfolioPosition, PortfolioSummary } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { Chip, Panel, PanelEmpty, TabHeading } from './Panel'
import { SplitPane } from './split'
import { Loading, Notice, UnderlineTabs } from './shared'
import { fmtMoney, fmtN, fmtPct, fmtQty, plColor, UNIT_FOR_TYPE } from './portfolio-calc'

type ListTab = 'open' | 'closed'

const LIST_TABS = [
  { id: 'open' as const, label: 'Açık' },
  { id: 'closed' as const, label: 'Kapanan' },
]

const TYPE_LABEL: Record<string, string> = {
  stock: 'BİST',
  us_stock: 'ABD',
  fund: 'Fon',
}

const TH =
  'bg-card border-faint text-mid sticky top-0 z-[2] border-b py-2 text-left font-medium whitespace-nowrap'

function today(): string {
  return new Date().toISOString().slice(0, 10)
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
  'num border-faint bg-card text-ink focus:border-info w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none'

const primaryButtonClass =
  'w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-[13px] font-medium transition-opacity hover:opacity-85 disabled:opacity-50 bg-[var(--ink)] text-[var(--card)]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="text-mid mb-1 block text-[11px]">{label}</span>
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
  onDone: () => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
      setError(d.issues?.[0]?.message ?? 'Kaydedilemedi.')
      return
    }
    onDone()
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
          <select
            value={form.type}
            onChange={set('type')}
            disabled={position != null}
            className={`${inputClass} disabled:opacity-60`}
          >
            <option value="stock">BİST hissesi</option>
            <option value="us_stock">ABD hissesi</option>
            <option value="fund">Yatırım fonu</option>
          </select>
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
        <p className="text-mid mb-3 text-[11px] leading-[1.6]">
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
      setError(d.message ?? d.issues?.[0]?.message ?? 'Satış kaydedilemedi.')
      return
    }
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
        <p className="text-mid mb-3 text-[11px] leading-[1.6]">
          Kısmi satış: {fmtQty(held - sold)} adet açık kalacak.
        </p>
      )}

      {preview && (
        <div className="border-faint2 mb-3 flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-mid text-[11px]">Gerçekleşecek K/Z</span>
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

type RightMode = 'new' | 'edit' | 'close'

export function VirtualPortfolioTab() {
  const { authenticated, loading: sessionLoading, username, logout } = useSession()

  const [tab, setTab] = useState<ListTab>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<RightMode>('new')
  const [version, setVersion] = useState(0)

  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [closed, setClosed] = useState<PortfolioClosedPosition[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  function afterWrite() {
    setSelectedId(null)
    setMode('new')
    reload()
  }

  async function remove(p: PortfolioPosition) {
    if (
      !window.confirm(
        `${p.symbol} pozisyonu tamamen silinecek. Bu bir satış kaydı OLUŞTURMAZ — ` +
          `geçmişte de görünmez ve geri alınamaz.\n\nSatış yapmak istiyorsanız "Sat" kullanın.`,
      )
    )
      return
    const res = await fetch(`/api/portfolio/manage/positions/${p.id}`, { method: 'DELETE' })
    if (res.ok) afterWrite()
    else setError('Pozisyon silinemedi.')
  }

  async function removeClosed(c: PortfolioClosedPosition & { id?: string }) {
    if (!c.id) return
    if (!window.confirm(`${c.symbol} satış kaydı silinecek. Geri alınamaz.`)) return
    const res = await fetch(`/api/portfolio/manage/closed-positions/${c.id}`, { method: 'DELETE' })
    if (res.ok) reload()
    else setError('Kayıt silinemedi.')
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
                <th className={`${TH} pr-3 pl-[18px]`}>Varlık</th>
                <th className={`${TH} px-3 text-right`}>Adet</th>
                <th className={`${TH} px-3 text-right`}>Maliyet</th>
                <th className={`${TH} px-3 text-right`}>K/Z %</th>
                <th className={`${TH} pr-[18px] pl-3 text-right`}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const unit = UNIT_FOR_TYPE[p.type] ?? ''
                return (
                  <tr
                    key={p.id}
                    className="border-faint2 hover:bg-bg border-b"
                    style={{ background: selectedId === p.id ? 'var(--bg)' : 'transparent' }}
                  >
                    <td className="pr-3 pl-[18px]">
                      <div className="text-[13px] font-semibold">{p.symbol}</div>
                      <div className="text-mid text-[11px]">
                        {TYPE_LABEL[p.type] ?? p.type}
                        {p.name ? ` · ${p.name}` : ''}
                      </div>
                    </td>
                    <td className="num px-3 text-right whitespace-nowrap">{fmtQty(p.quantity)}</td>
                    <td className="num px-3 text-right whitespace-nowrap">
                      {fmtMoney(p.buyPrice, unit)}
                    </td>
                    <td
                      className="num px-3 text-right whitespace-nowrap"
                      style={{ color: plColor(p.plPercent) }}
                    >
                      {fmtPct(p.plPercent)}
                    </td>
                    <td className="pr-[18px] pl-3">
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
              <th className={`${TH} pr-3 pl-[18px]`}>Varlık</th>
              <th className={`${TH} px-3 text-right`}>Adet</th>
              <th className={`${TH} px-3 text-right`}>Satış</th>
              <th className={`${TH} px-3 text-right`}>K/Z %</th>
              <th className={`${TH} pr-[18px] pl-3 text-right`}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {closed.map((c) => (
              <tr key={`${c.symbol}-${c.sellDate}-${c.sellPrice}`} className="border-faint2 hover:bg-bg border-b">
                <td className="pr-3 pl-[18px]">
                  <div className="text-[13px] font-semibold">{c.symbol}</div>
                  <div className="num text-mid text-[11px]">{c.sellDate.slice(0, 10)}</div>
                </td>
                <td className="num px-3 text-right whitespace-nowrap">{fmtQty(c.quantity)}</td>
                <td className="num px-3 text-right whitespace-nowrap">{fmtN(c.sellPrice, 2)}</td>
                <td
                  className="num px-3 text-right whitespace-nowrap"
                  style={{ color: plColor(c.pl) }}
                >
                  {fmtPct(c.plPercent)}
                </td>
                <td className="pr-[18px] pl-3">
                  <div className="flex justify-end">
                    <RowButton onClick={() => removeClosed(c)} danger>
                      Sil
                    </RowButton>
                  </div>
                </td>
              </tr>
            ))}
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

  return (
    <div>
      <TabHeading
        title="Sanal Portföy"
        subtitle="Pozisyonlarını buradan ekle, düzenle ve kapat."
        right={
          <div className="flex items-center gap-2">
            <Chip>{username}</Chip>
            <button
              onClick={logout}
              className="text-mid hover:text-ink cursor-pointer border-0 bg-transparent p-0 text-xs"
            >
              Çıkış
            </button>
          </div>
        }
      />
      <SplitPane splitKey="virtual" a={listPanel} b={formPanel} />
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
      className="border-faint hover:bg-faint2 cursor-pointer rounded-md border px-2 py-1 text-[11px] transition-colors"
      style={{ color: danger ? 'var(--down)' : 'var(--mid)' }}
    >
      {children}
    </button>
  )
}
