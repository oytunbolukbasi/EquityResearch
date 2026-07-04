import { useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import type { MacroBullet, MorningNote } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

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

function Bullet({ b }: { b: MacroBullet }) {
  if (typeof b === 'string') return <span>{b}</span>
  return (
    <span>
      <span className="font-medium">{b.label}</span>
      {b.detail && <span className="text-mid"> — {b.detail}</span>}
    </span>
  )
}

function DateNav({
  notes,
  index,
  onChange,
}: {
  notes: MorningNote[]
  index: number
  onChange: (i: number) => void
}) {
  const note = notes[index]
  const dateStr = dateFmt.format(new Date(note.date + 'T12:00:00'))
  const isNewest = index === 0
  const isOldest = index >= notes.length - 1

  return (
    <div className="flex items-center justify-center gap-1 pb-3">
      <button
        disabled={isOldest}
        onClick={() => onChange(index + 1)}
        className="rounded p-0.5 text-mid transition-colors hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Önceki kayıt"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="num min-w-[140px] text-center text-[11px] font-medium tracking-wide text-mid">
        {dateStr}
      </span>
      <button
        disabled={isNewest}
        onClick={() => onChange(index - 1)}
        className="rounded p-0.5 text-mid transition-colors hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Sonraki kayıt"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export function MorningNoteWidget() {
  const [index, setIndex] = useState(0)
  const { data: notes, loading, error } = useApi<MorningNote[]>('/api/morning-notes/history')

  if (loading) return <Loading />
  if (error) return <Empty>Veri alınamadı.</Empty>
  if (!notes?.length) return <Empty>Henüz morning note eklenmedi.</Empty>

  const safeIndex = Math.min(index, notes.length - 1)
  const note = notes[safeIndex]

  return (
    <div className="space-y-4">
      <DateNav notes={notes} index={safeIndex} onChange={setIndex} />

      {note.topCall && (
        <section>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-warn">Ana Görüş</h3>
          <p className="text-sm font-medium leading-relaxed">{note.topCall}</p>
        </section>
      )}

      {note.macroBullets && note.macroBullets.length > 0 && (
        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-mid">Makro</h3>
          <ul className="space-y-2">
            {note.macroBullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 shrink-0 text-mid">·</span>
                <Bullet b={b} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(note.sectorDeepDive?.title || note.sectorDeepDive?.body) && (
        <section>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-mid">
            Sektör Odağı
          </h3>
          {note.sectorDeepDive.title && (
            <p className="mb-1 text-sm font-medium">{note.sectorDeepDive.title}</p>
          )}
          {note.sectorDeepDive.body && (
            <p className="text-sm leading-relaxed text-mid">{note.sectorDeepDive.body}</p>
          )}
        </section>
      )}
    </div>
  )
}
