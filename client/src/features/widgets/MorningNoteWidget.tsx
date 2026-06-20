import { Loader2 } from 'lucide-react'

import type { MacroBullet, MorningNote } from '@/lib/api-types'
import { useApi } from '@/lib/use-api'

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

export function MorningNoteWidget() {
  const { data: note, loading, error } = useApi<MorningNote | null>('/api/morning-notes')

  if (loading) return <Loading />
  if (error) return <Empty>Veri alınamadı.</Empty>
  if (!note) return <Empty>Henüz morning note eklenmedi.</Empty>

  const dateStr = new Date(note.date + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      <p className="num text-[10px] uppercase tracking-[0.12em] text-mid">{dateStr}</p>

      {note.topCall && (
        <section>
          <h3 className="num mb-1.5 text-[10px] uppercase tracking-[0.12em] text-warn">Ana Görüş</h3>
          <p className="text-sm font-medium leading-relaxed">{note.topCall}</p>
        </section>
      )}

      {note.macroBullets && note.macroBullets.length > 0 && (
        <section>
          <h3 className="num mb-2 text-[10px] uppercase tracking-[0.12em] text-mid">Makro</h3>
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
          <h3 className="num mb-1.5 text-[10px] uppercase tracking-[0.12em] text-mid">
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
