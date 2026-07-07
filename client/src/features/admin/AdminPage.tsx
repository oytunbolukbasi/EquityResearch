import { useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'

// ─── table config ─────────────────────────────────────────────────────────────
type TableTarget = 'morning_notes' | 'ideas' | 'trade_plans'

const TABLES: { id: TableTarget; label: string; endpoint: string }[] = [
  { id: 'morning_notes', label: 'Piyasa Nabzı',          endpoint: '/api/morning-notes' },
  { id: 'ideas',         label: 'Pozisyon Fikri',        endpoint: '/api/ideas'         },
  { id: 'trade_plans',   label: 'Trade Planı',           endpoint: '/api/trade-plans'  },
]

const EXAMPLES: Record<TableTarget, unknown> = {
  morning_notes: {
    date: '2026-06-20',
    topCall: 'Ana görüş metni',
    macroBullets: ['Madde 1', { label: 'Başlık', detail: 'Detay' }],
    sectorDeepDive: { title: 'Sektör adı', body: 'Açıklama' },
  },
  ideas: [
    {
      date: '2026-06-20',
      ticker: 'ASELS',
      exchange: 'BIST',
      direction: 'long',
      thesis: 'Tez metni',
      entryLow: 62,
      entryHigh: 65,
      stopLoss: 58,
      target1: 75,
      status: 'active',
    },
  ],
  trade_plans: {
    ticker: 'MA',
    exchange: 'NYSE',
    currentPrice: 492.99,
    entryLow: 485,
    entryHigh: 500,
    tp1: 540,
    tp2: 580,
    tp3: 625,
    hardSl: 455,
    thesis: 'NTM F/K 24.2x tarihsel ort. altında.',
    invalidation: '$455 altı kapanış tezi bozar.',
    priceHistory: [
      { t: '2026-06-01', o: 490, h: 498, l: 485, c: 493 },
    ],
  },
}

// ─── bulk import ──────────────────────────────────────────────────────────────
const BULK_PLACEHOLDER = `{
  "morning_note": { "date": "2026-06-22", "topCall": "..." },
  "ideas": [{ "date": "2026-06-22", "ticker": "ENKAI", ... }],
  "trade_plans": [{ "ticker": "ENKAI", "currentPrice": 92.35 }]
}`

type BulkTableResult = number | { error: string }
type BulkResponse = { success: boolean; results: Record<string, BulkTableResult> }

// ─── main component ───────────────────────────────────────────────────────────
export function AdminPage() {
  const [adminKey, setAdminKey]       = useState(() => localStorage.getItem('eqr:admin-key') ?? '')
  const [keyDraft, setKeyDraft]       = useState('')
  const [showKeyForm, setShowKeyForm] = useState(!localStorage.getItem('eqr:admin-key'))
  const [table, setTable]             = useState<TableTarget>('morning_notes')
  const [json, setJson]               = useState('')
  const [showExample, setShowExample] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState<
    { ok: true; count: number; ids: number[] } |
    { ok: false; message: string } |
    null
  >(null)

  // Bulk import
  const [bulkJson, setBulkJson]             = useState('')
  const [bulkLoading, setBulkLoading]       = useState(false)
  const [bulkParseError, setBulkParseError] = useState<string | null>(null)
  const [bulkResult, setBulkResult]         = useState<
    { kind: 'response'; data: BulkResponse } |
    { kind: 'http-error'; message: string } |
    null
  >(null)

  async function submitBulk() {
    setBulkParseError(null)
    setBulkResult(null)

    let body: unknown
    try {
      body = JSON.parse(bulkJson)
    } catch (e) {
      setBulkParseError(`Geçersiz JSON: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    setBulkLoading(true)
    try {
      const res = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body),
      })

      if (res.status === 401) {
        setBulkResult({ kind: 'http-error', message: 'Yetkisiz: admin anahtarı hatalı.' })
        return
      }

      const data = (await res.json().catch(() => null)) as unknown
      if (!res.ok) {
        const msg = data && typeof data === 'object' && 'error' in data
          ? String((data as Record<string, unknown>).error)
          : `HTTP ${res.status}`
        setBulkResult({ kind: 'http-error', message: msg })
        return
      }

      setBulkResult({ kind: 'response', data: data as BulkResponse })
    } catch (e) {
      setBulkResult({ kind: 'http-error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBulkLoading(false)
    }
  }

  function clearBulk() {
    setBulkJson('')
    setBulkParseError(null)
    setBulkResult(null)
  }

  function saveKey() {
    const trimmed = keyDraft.trim()
    if (!trimmed) return
    localStorage.setItem('eqr:admin-key', trimmed)
    setAdminKey(trimmed)
    setKeyDraft('')
    setShowKeyForm(false)
  }

  function resetKey() {
    localStorage.removeItem('eqr:admin-key')
    setAdminKey('')
    setShowKeyForm(true)
    setKeyDraft('')
  }

  // Parse JSON and flag syntax errors
  let parseError: string | null = null
  if (json.trim()) {
    try {
      JSON.parse(json)
    } catch (e) {
      parseError = e instanceof SyntaxError ? e.message : 'JSON hatası'
    }
  }

  async function submit() {
    if (!adminKey || !json.trim() || parseError) return
    setLoading(true)
    setResult(null)

    try {
      const body = JSON.parse(json) as unknown
      const endpoint = TABLES.find(t => t.id === table)!.endpoint

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify(body),
      })

      if (res.status === 401) {
        setResult({ ok: false, message: 'Yetkisiz: admin anahtarı hatalı.' })
        return
      }

      const data = (await res.json()) as unknown

      if (!res.ok) {
        const msg = data && typeof data === 'object' && 'error' in data
          ? String((data as Record<string, unknown>).error)
          : `HTTP ${res.status}`
        const issues = data && typeof data === 'object' && 'issues' in data
          ? JSON.stringify((data as Record<string, unknown>).issues, null, 2)
          : null
        setResult({ ok: false, message: issues ? `${msg}\n\n${issues}` : msg })
        return
      }

      const rows = Array.isArray(data) ? data : [data]
      const ids = rows
        .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
        .map(r => Number(r['id']))
        .filter(n => !isNaN(n))
      setResult({ ok: true, count: rows.length, ids })
      setJson('')
    } catch (e) {
      setResult({ ok: false, message: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const selectedLabel = TABLES.find(t => t.id === table)!.label
  const exampleJson = JSON.stringify(EXAMPLES[table], null, 2)

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] items-center gap-4 px-5 py-3 sm:px-8">
          <a
            href="/"
            className="text-mid hover:text-ink flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </a>
          <h1 className="text-base font-semibold">İçerik Ekle</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] space-y-6 px-5 py-8 sm:px-8">

        {/* Admin key section */}
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="text-mid size-4" />
              <span className="text-sm font-medium">Admin Anahtarı</span>
            </div>
            {adminKey && !showKeyForm && (
              <button
                onClick={resetKey}
                className="num text-mid hover:text-ink text-[11px] uppercase tracking-wider transition-colors"
              >
                Değiştir
              </button>
            )}
          </div>

          {showKeyForm ? (
            <div className="flex gap-2">
              <input
                type="password"
                value={keyDraft}
                onChange={e => setKeyDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveKey()}
                placeholder="Admin anahtarını girin"
                className="num flex-1 rounded border border-faint bg-bg px-3 py-2 text-sm outline-none focus:border-info focus:ring-1 focus:ring-info"
                autoFocus
              />
              <Button onClick={saveKey} size="sm" disabled={!keyDraft.trim()}>
                Kaydet
              </Button>
            </div>
          ) : (
            <p className="num text-sm text-mid">
              {'•'.repeat(Math.min(adminKey.length, 16))}
            </p>
          )}
        </section>

        {/* Bulk import */}
        <section className="rounded-lg border bg-card p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Toplu İçerik Girişi</p>

          <textarea
            value={bulkJson}
            onChange={e => { setBulkJson(e.target.value); setBulkParseError(null); setBulkResult(null) }}
            spellCheck={false}
            placeholder={BULK_PLACEHOLDER}
            style={{ minHeight: 320, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
            className={[
              'w-full resize-y rounded border bg-bg px-3 py-2.5 leading-relaxed outline-none transition-colors',
              bulkParseError
                ? 'border-down/50 focus:border-down focus:ring-1 focus:ring-down/30'
                : 'border-faint focus:border-info focus:ring-1 focus:ring-info/30',
            ].join(' ')}
          />

          {bulkParseError && (
            <p className="mt-1.5 text-xs text-down">{bulkParseError}</p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={clearBulk}
              disabled={bulkLoading}
            >
              Temizle
            </Button>
            <Button
              size="sm"
              onClick={submitBulk}
              disabled={!adminKey || !bulkJson.trim() || bulkLoading}
              className="gap-2 bg-info text-white hover:bg-info/90"
            >
              {bulkLoading && <Loader2 className="size-4 animate-spin" />}
              {bulkLoading ? 'Gönderiliyor...' : 'İçeriği Gönder'}
            </Button>
          </div>

          {!adminKey && (
            <p className="mt-2 text-right text-xs text-mid">Önce admin anahtarı girilmeli.</p>
          )}

          {bulkResult && (
            <BulkResultBox result={bulkResult} />
          )}
        </section>

        {/* Table selector */}
        <section className="rounded-lg border bg-card p-5">
          <p className="num mb-3 text-[10px] uppercase tracking-[0.12em] text-mid">Hedef Tablo</p>
          <div className="flex flex-wrap gap-2">
            {TABLES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTable(t.id); setResult(null); setShowExample(false) }}
                className={[
                  'num rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  table === t.id
                    ? 'border-info bg-info/10 text-info'
                    : 'border-faint bg-bg text-mid hover:border-faint2 hover:text-ink',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* JSON input */}
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="num text-[10px] uppercase tracking-[0.12em] text-mid">
              JSON Verisi — {selectedLabel}
            </p>
            <div className="flex items-center gap-3">
              {json.trim() && !parseError && (
                <span className="flex items-center gap-1 text-xs text-up">
                  <CheckCircle2 className="size-3.5" /> Geçerli JSON
                </span>
              )}
              {parseError && (
                <span className="flex items-center gap-1 text-xs text-down">
                  <XCircle className="size-3.5" /> JSON hatası
                </span>
              )}
              <button
                onClick={() => setShowExample(v => !v)}
                className="num text-mid hover:text-ink text-[11px] uppercase tracking-wider transition-colors"
              >
                {showExample ? 'Örneği Gizle' : 'Örnek Göster'}
              </button>
            </div>
          </div>

          {showExample && (
            <pre className="num mb-3 overflow-auto rounded bg-bg p-3 text-[11px] leading-relaxed text-mid">
              {exampleJson}
            </pre>
          )}

          <textarea
            value={json}
            onChange={e => { setJson(e.target.value); setResult(null) }}
            rows={14}
            spellCheck={false}
            placeholder={`{\n  // ${selectedLabel} JSON yapıştır\n}`}
            className={[
              'num w-full resize-y rounded border bg-bg px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors',
              parseError && json.trim()
                ? 'border-down/50 focus:border-down focus:ring-1 focus:ring-down/30'
                : 'border-faint focus:border-info focus:ring-1 focus:ring-info/30',
            ].join(' ')}
          />

          {parseError && json.trim() && (
            <p className="mt-1.5 text-xs text-down">{parseError}</p>
          )}
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <Button
            onClick={submit}
            disabled={!adminKey || !json.trim() || !!parseError || loading}
            className="gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Gönderiliyor…' : `${selectedLabel} Ekle`}
          </Button>

          {!adminKey && (
            <p className="text-xs text-mid">Önce admin anahtarı girilmeli.</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div
            className={[
              'flex items-start gap-3 rounded-lg border p-4 text-sm',
              result.ok
                ? 'border-up/30 bg-up/5 text-up'
                : 'border-down/30 bg-down/5 text-down',
            ].join(' ')}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0" />
            )}
            <div>
              {result.ok ? (
                <>
                  <p className="font-medium">
                    {result.count} kayıt eklendi{result.ids.length ? ` (ID: ${result.ids.join(', ')})` : ''}.
                  </p>
                  <p className="mt-0.5 text-xs opacity-70">
                    Dashboard'a dönüp widget'ı yenileyebilirsiniz.
                  </p>
                </>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                  {result.message}
                </pre>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── bulk import result box ────────────────────────────────────────────────────
function BulkResultBox({
  result,
}: {
  result: { kind: 'response'; data: BulkResponse } | { kind: 'http-error'; message: string }
}) {
  if (result.kind === 'http-error') {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-lg border border-down/30 bg-down/5 p-4 text-sm text-down">
        <XCircle className="mt-0.5 size-5 shrink-0" />
        <p>{result.message}</p>
      </div>
    )
  }

  const entries = Object.entries(result.data.results)
  const hasError = entries.some(([, v]) => typeof v === 'object')
  const hasSuccess = entries.some(([, v]) => typeof v === 'number')
  const kind = !entries.length || (hasError && !hasSuccess) ? 'error' : hasError ? 'partial' : 'success'

  const boxClass = {
    success: 'border-up/30 bg-up/5 text-up',
    partial: 'border-warn/30 bg-warn/5 text-warn',
    error: 'border-down/30 bg-down/5 text-down',
  }[kind]

  return (
    <div className={`mt-3 flex items-start gap-3 rounded-lg border p-4 text-sm ${boxClass}`}>
      {kind === 'error' ? (
        <XCircle className="mt-0.5 size-5 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.length === 0 && <p>Hiçbir tablo gönderilmedi.</p>}
        {entries.map(([tableName, v]) => (
          <span key={tableName} className="num text-xs">
            {typeof v === 'number' ? `✓ ${tableName}: ${v} kayıt` : `✗ ${tableName}: ${v.error}`}
          </span>
        ))}
      </div>
    </div>
  )
}
