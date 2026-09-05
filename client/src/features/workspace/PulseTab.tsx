import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { MorningNote } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'
import { SplitPane } from './split'
import { Loading, Notice } from './shared'
import { fmtNoteDate, noteSections, readMinutes } from './note-sections'

/**
 * `/api/morning-notes/history` is ordered newest-first, so index 0 is today's
 * note and the stepper walks backwards through the notes that actually exist —
 * no calendar, no empty days.
 */
export function PulseTab({
  jumpTo,
  onJumpHandled,
  onBack,
}: {
  /** Section anchor requested from the overview brief, consumed once on arrival. */
  jumpTo: string | null
  onJumpHandled: () => void
  onBack: () => void
}) {
  const [index, setIndex] = useState(0)
  const articleRef = useRef<HTMLElement>(null)
  const { data: notes, loading, error } = useApi<MorningNote[]>('/api/morning-notes/history')

  const safeIndex = notes?.length ? Math.min(index, notes.length - 1) : 0
  const note = notes?.[safeIndex] ?? null
  const sections = noteSections(note)

  function scrollToSection(id: string) {
    const art = articleRef.current
    const sec = art?.querySelector<HTMLElement>(`[data-sec="${id}"]`)
    if (!art || !sec) return
    art.scrollTop =
      sec.getBoundingClientRect().top - art.getBoundingClientRect().top + art.scrollTop - 12
  }

  // Runs before paint so arriving from the overview lands on the section
  // directly, without a visible scroll from the top.
  useLayoutEffect(() => {
    if (!jumpTo || !note) return
    scrollToSection(jumpTo)
    onJumpHandled()
  }, [jumpTo, note, onJumpHandled])

  // Stepping to another day should start that bulletin from its beginning.
  useEffect(() => {
    if (articleRef.current) articleRef.current.scrollTop = 0
  }, [safeIndex])

  if (loading) return <Loading />
  if (error) return <Notice>Bülten verisi alınamadı.</Notice>
  if (!notes?.length) return <Notice>Henüz bülten eklenmedi.</Notice>

  const isNewest = safeIndex === 0
  const isOldest = safeIndex >= notes.length - 1

  // No visible "İçindekiler" heading: a list of the note's section titles, sat
  // beside the note itself, needs no label. The nav's aria-label still names it
  // for screen readers.
  const toc = (
    <nav className="min-w-0 py-3" aria-label="Bülten içindekiler">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => scrollToSection(s.id)}
          className="group block w-full cursor-pointer border-0 bg-transparent py-2.5 text-left"
        >
          {s.kicker && (
            <small className="text-mid group-hover:text-info mb-[3px] block text-[12px] font-semibold transition-colors">
              {s.kicker}
            </small>
          )}
          {/* --ink rather than --mid: these are headings, and the contents is
              the one place the whole note is skimmed. Hover has to be driven
              from the button (group-), since a colour set here would win. */}
          <span className="text-ink group-hover:text-info block text-xs leading-[1.6] font-semibold transition-colors">
            {s.label}
          </span>
        </button>
      ))}
    </nav>
  )

  const article = (
    <article
      ref={articleRef}
      className="bg-card border-faint min-w-0 overflow-auto rounded-xl border px-[35px] py-8"
      style={{ maxHeight: '78vh' }}
    >
      <header className="mb-7">
        <span
          className="text-[12px] font-medium tracking-[0.7px]"
          style={{ color: 'var(--warn)' }}
        >
          EQR / GÜNLÜK ARAŞTIRMA
        </span>
        <h1 className="mt-[11px] mb-2.5 text-[29px] leading-[1.25] font-medium tracking-[-1px]">
          Piyasa Nabzı
        </h1>
        <div className="text-mid num flex flex-wrap gap-3.5 text-[12px]">
          <span>{fmtNoteDate(note?.date)}</span>
          <span>{note ? `${readMinutes(note)} dk okuma` : ''}</span>
        </div>
      </header>

      {sections.map((s, i) => (
        <section key={s.id} data-sec={s.id} className="my-[18px] mb-[26px]">
          {s.id !== 'main' && (
            <span className="text-mid num text-[12px]">
              {s.id === 'sector' ? 'Sektör odağı' : String(i).padStart(2, '0')}
            </span>
          )}
          <h2 className="mt-1 mb-2.5 text-[19px] font-medium tracking-[-0.4px]">{s.label}</h2>
          {s.detail && (
            <p className="m-0 whitespace-pre-line text-sm leading-[1.9]">{s.detail}</p>
          )}
        </section>
      ))}
    </article>
  )

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-info cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium hover:underline"
        >
          ← Genel bakışa dön
        </button>

        <div className="flex items-center gap-1.5">
          <StepButton
            disabled={isOldest}
            onClick={() => setIndex(safeIndex + 1)}
            label="Önceki bülten"
          >
            ‹
          </StepButton>
          <span className="num min-w-[150px] text-center text-xs font-medium">
            {fmtNoteDate(note?.date)}
          </span>
          <StepButton
            disabled={isNewest}
            onClick={() => setIndex(safeIndex - 1)}
            label="Sonraki bülten"
          >
            ›
          </StepButton>
          <span className="text-mid num ml-1.5 text-[12px]">
            {safeIndex + 1}/{notes.length}
          </span>
        </div>
      </div>

      <SplitPane splitKey="reader" a={toc} b={article} swappable={false} />
    </div>
  )
}

function StepButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="border-faint bg-card text-ink hover:bg-faint2 cursor-pointer rounded-[7px] border px-2.5 py-[3px] text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  )
}
