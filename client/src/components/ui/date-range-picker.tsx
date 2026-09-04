import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface DateRange {
  /** ISO yyyy-mm-dd, inclusive. null on both sides means all time. */
  from: string | null
  to: string | null
}

export type RangePreset = 'today' | 'month' | 'all' | 'custom'

const MONTH_FMT = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
const DAY_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Monday-first, matching how a Turkish calendar reads. */
const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']

function iso(d: Date): string {
  // Local calendar date, not UTC: toISOString() would shift a late-evening
  // click to the next day for anyone east of Greenwich.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function presetRange(preset: RangePreset): DateRange {
  const now = new Date()
  if (preset === 'today') return { from: iso(now), to: iso(now) }
  if (preset === 'month') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
  }
  return { from: null, to: null }
}

/**
 * Which preset a range corresponds to, or 'custom' for a hand-picked one.
 *
 * Shared with the Analiz tab: its period strip words itself as "Bugün" or "Bu
 * ay" rather than repeating the dates the picker already shows, so it needs the
 * same answer the picker highlights.
 */
export function rangePreset(value: DateRange): RangePreset {
  if (!value.from && !value.to) return 'all'
  const now = new Date()
  const today = iso(now)
  if (value.from === today && value.to === today) return 'today'
  if (value.from === iso(new Date(now.getFullYear(), now.getMonth(), 1)) && value.to === today) {
    return 'month'
  }
  return 'custom'
}

export function formatRange(range: DateRange): string {
  if (!range.from && !range.to) return 'Tüm zamanlar'
  const from = range.from ? DAY_FMT.format(parse(range.from)) : '…'
  const to = range.to ? DAY_FMT.format(parse(range.to)) : '…'
  return from === to ? from : `${from} – ${to}`
}

/** Days of `month`, padded so the grid starts on a Monday. */
function monthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  }
  return cells
}

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Günlük' },
  { id: 'month', label: 'Aylık' },
  { id: 'all', label: 'Tümü' },
]

/**
 * Date-range control: three presets plus a click-through calendar.
 *
 * Hand-rolled rather than pulled from react-day-picker — a calendar is a month
 * grid and two comparisons, and a library would have cost ~30 kB plus a date
 * library to render one field, in a panel that deliberately carries almost no
 * dependencies. Month and weekday names come from Intl, so they are Turkish
 * without a locale bundle.
 */
export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [month, setMonth] = useState(() => (value.from ? parse(value.from) : new Date()))
  /** Set after the first click; the second click closes the range. */
  const [anchor, setAnchor] = useState<string | null>(null)

  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
      setAnchor(null)
    }
    setOpen((v) => !v)
  }

  function pickPreset(id: RangePreset) {
    onChange(presetRange(id))
    setAnchor(null)
    setOpen(false)
  }

  function pickDay(d: Date) {
    const day = iso(d)
    if (!anchor) {
      // First click starts a new range; show it immediately as a single day so
      // the selection never looks empty.
      setAnchor(day)
      onChange({ from: day, to: day })
      return
    }
    const [from, to] = anchor <= day ? [anchor, day] : [day, anchor]
    onChange({ from, to })
    setAnchor(null)
    setOpen(false)
  }

  const today = iso(new Date())
  const activePreset = rangePreset(value)

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="border-faint bg-card text-ink hover:bg-faint2 num cursor-pointer rounded-lg border px-2.5 py-1 text-[12px] transition-colors"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {formatRange(value)}
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Tarih aralığı seç"
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 300, width: 268 }}
            className="border-faint bg-card rounded-xl border p-3 shadow-lg"
          >
            <div className="mb-3 flex gap-1.5">
              {PRESETS.map((p) => {
                const on = activePreset === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => pickPreset(p.id)}
                    className="flex-1 cursor-pointer rounded-lg border px-2 py-1 text-[12px] font-medium transition-colors"
                    style={{
                      borderColor: on ? 'var(--info)' : 'var(--faint)',
                      background: on ? 'var(--info-tint)' : 'transparent',
                      color: on ? 'var(--info)' : 'var(--mid)',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <NavButton
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                label="Önceki ay"
              >
                ‹
              </NavButton>
              <span className="text-[12px] font-medium">{MONTH_FMT.format(month)}</span>
              <NavButton
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                label="Sonraki ay"
              >
                ›
              </NavButton>
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-mid pb-1 text-center text-[12px]">
                  {w}
                </div>
              ))}
              {monthGrid(month).map((d, i) => {
                if (!d) return <div key={`pad-${i}`} />
                const day = iso(d)
                const inRange =
                  value.from != null && value.to != null && day >= value.from && day <= value.to
                const isEdge = day === value.from || day === value.to
                // A sale can't be in the future, so those days aren't selectable.
                const future = day > today
                return (
                  <button
                    key={day}
                    disabled={future}
                    onClick={() => pickDay(d)}
                    className="num h-7 cursor-pointer rounded-md border-0 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-25"
                    style={{
                      background: isEdge
                        ? 'var(--info)'
                        : inRange
                          ? 'var(--info-tint)'
                          : 'transparent',
                      color: isEdge ? 'var(--card)' : inRange ? 'var(--info)' : 'var(--ink)',
                      fontWeight: day === today ? 700 : 400,
                    }}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            {anchor && (
              <p className="text-mid mt-2 text-center text-[12px]">Bitiş tarihini seçin</p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

function NavButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="border-faint hover:bg-faint2 text-mid cursor-pointer rounded-md border px-2 py-0.5 text-[13px] transition-colors"
    >
      {children}
    </button>
  )
}
