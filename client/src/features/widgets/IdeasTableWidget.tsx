import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { IoInformationCircleOutline } from 'react-icons/io5'

import type { Idea } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { useSelectedTicker } from '@/features/dashboard/selected-ticker'
import { StatusTabs, type StatusTab } from './StatusTabs'
import { RiskRewardBar } from '@/components/ui/risk-reward-bar'

const HISTORY_STATUSES = new Set(['stopped', 'tp1_hit', 'tp2_hit', 'tp3_hit'])

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

function fmtN(n: number | null, decimals = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (direction === 'long')
    return (
      <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
        style={{ background: '#edf5f2', color: '#1a7a5e' }}>
        LONG
      </span>
    )
  if (direction === 'short')
    return (
      <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
        style={{ background: '#fdf0ee', color: '#c0392b' }}>
        SHORT
      </span>
    )
  return <span className="text-mid text-xs">—</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active:     { label: 'Aktif',  bg: '#eef3fb', color: '#2563a8' },
    hit_target: { label: 'Hedef', bg: '#edf5f2', color: '#1a7a5e' },
    tp1_hit:    { label: 'TP1',   bg: '#edf5f2', color: '#1a7a5e' },
    tp2_hit:    { label: 'TP2',   bg: '#edf5f2', color: '#1a7a5e' },
    tp3_hit:    { label: 'TP3',   bg: '#edf5f2', color: '#1a7a5e' },
    review:     { label: 'İncele', bg: '#fef8e9', color: '#9a6200' },
    stopped:    { label: 'SL',    bg: '#fdf0ee', color: '#c0392b' },
    watch:      { label: 'İzle',  bg: '#fef8e9', color: '#9a6200' },
  }
  const cfg = map[status] ?? { label: status, bg: '#f5f4f0', color: '#9a9a94' }
  return (
    <span className="num rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function RiskRewardTooltip() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle() }}
        className="ml-0.5 align-middle transition-colors"
        style={{ color: 'var(--mid)', lineHeight: 0 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mid)')}
      >
        <IoInformationCircleOutline size={13} />
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              top: pos.top,
              right: pos.right,
              zIndex: 9999,
              width: 280,
            }}
            className="rounded-lg border border-faint bg-card p-3 shadow-lg"
          >
            <p className="mb-1 text-xs font-semibold text-ink">Risk/Getiri Oranı</p>
            <p className="text-[11px] leading-relaxed text-mid">
              Potansiyel kazancın potansiyel kayba oranı:
            </p>
            <p className="num mt-1 text-[11px] font-medium text-ink">
              (TP1 − Giriş) ÷ (Giriş − Stop)
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mid">
              Giriş için bant ortalaması (Low + High) / 2 kullanılır. Örnek: Giriş 100, Stop 90, TP1 130 → R/R = 3,0×
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}

export function IdeasTableWidget() {
  const [tab, setTab] = useState<StatusTab>('active')
  const { setSelectedTicker } = useSelectedTicker()

  const { data: ideas, loading, error } = useApi<Idea[]>('/api/ideas')

  const visible = ideas?.filter((i) =>
    tab === 'active' ? !HISTORY_STATUSES.has(i.status) : HISTORY_STATUSES.has(i.status),
  )

  if (loading) return <Loading />
  if (error) return <Empty>Veri alınamadı.</Empty>

  const isHistory = tab === 'history'

  return (
    <div className="flex h-full flex-col">
      <StatusTabs tab={tab} onChange={setTab} />

      {!visible?.length ? (
        <Empty>{tab === 'active' ? 'Aktif fikir yok.' : 'Geçmiş kayıt yok.'}</Empty>
      ) : (
        <div className="-m-4 mt-0 min-h-0 flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-faint bg-card">
                <th className="num px-4 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Hisse</th>
                <th className="num px-3 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Yön</th>
                <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Giriş</th>
                <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">SL</th>
                <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">TP1</th>
                <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Risk/Getiri
                    <RiskRewardTooltip />
                  </span>
                </th>
                <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Öneri Tarihi</th>
                {isHistory && (
                  <th className="num px-3 py-2 text-right text-[10px] uppercase tracking-wider text-mid font-medium whitespace-nowrap">Bitiş Tarihi</th>
                )}
                <th className="num px-4 py-2 text-left text-[10px] uppercase tracking-wider text-mid font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((idea) => (
                <tr
                  key={idea.id}
                  onClick={() => setSelectedTicker(idea.ticker)}
                  className="cursor-pointer border-b border-faint2 hover:bg-bg"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-sm">{idea.ticker}</div>
                    {idea.exchange && (
                      <div className="num text-[10px] text-mid">{idea.exchange}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <DirectionBadge direction={idea.direction} />
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {idea.entryLow != null && idea.entryHigh != null
                      ? `${fmtN(idea.entryLow, 0)}–${fmtN(idea.entryHigh, 0)}`
                      : fmtN(idea.entryLow, 0)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap" style={{ color: '#c0392b' }}>
                    {fmtN(idea.stopLoss, 0)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap" style={{ color: '#1a7a5e' }}>
                    {fmtN(idea.target1, 0)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      {idea.stopLoss != null && idea.entryLow != null && idea.entryHigh != null && idea.target1 != null
                        ? <RiskRewardBar
                            stopLoss={idea.stopLoss}
                            entryLow={idea.entryLow}
                            entryHigh={idea.entryHigh}
                            target1={idea.target1}
                            direction={idea.direction}
                          />
                        : <span className="num text-mid text-xs">—</span>
                      }
                    </div>
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap" style={{ color: 'var(--mid)' }}>
                    {fmtDate(idea.firstDate)}
                  </td>
                  {isHistory && (
                    <td className="num px-3 py-2.5 text-right text-xs whitespace-nowrap" style={{ color: 'var(--mid)' }}>
                      {fmtDate(idea.endDate)}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <StatusBadge status={idea.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
