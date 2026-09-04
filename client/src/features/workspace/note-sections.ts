import type { MacroBullet, MorningNote } from '@/lib/api-types'

export interface NoteSection {
  /** Anchor id — matches the `data-sec` attribute the reader scrolls to. */
  id: string
  /** Small label above the heading in the table of contents. Empty when the
   *  heading already says everything (the lead section), so it doesn't read
   *  as "Ana görüş / Ana görüş". */
  kicker: string
  label: string
  detail: string
}

function splitBullet(b: MacroBullet): { label: string; detail: string } {
  if (typeof b === 'string') {
    // Legacy plain-string bullets: use the leading clause as the heading.
    const cut = b.indexOf('—')
    if (cut > 0) return { label: b.slice(0, cut).trim(), detail: b.slice(cut + 1).trim() }
    return { label: b, detail: '' }
  }
  return { label: b.label, detail: b.detail ?? '' }
}

/** Ordered sections of a note: Ana görüş, one per macro bullet, then Sektör Odağı. */
export function noteSections(note: MorningNote | null): NoteSection[] {
  if (!note) return []
  const out: NoteSection[] = []

  if (note.topCall) {
    out.push({ id: 'main', kicker: '', label: 'Ana görüş', detail: note.topCall })
  }

  ;(note.macroBullets ?? []).forEach((b, i) => {
    const { label, detail } = splitBullet(b)
    out.push({
      id: `macro-${i}`,
      kicker: `Makro ${String(i + 1).padStart(2, '0')}`,
      label,
      detail,
    })
  })

  const dd = note.sectorDeepDive
  if (dd?.title || dd?.body) {
    out.push({
      id: 'sector',
      kicker: 'Sektör odağı',
      label: dd.title ?? 'Sektör odağı',
      detail: dd.body ?? '',
    })
  }

  return out
}

/** Rough read time at 200 words/minute — shown as a "· N dk okuma" meta line. */
export function readMinutes(note: MorningNote | null): number {
  const words = noteSections(note)
    .map((s) => `${s.label} ${s.detail}`)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function fmtNoteDate(date: string | null | undefined): string {
  if (!date) return '—'
  return dateFmt.format(new Date(`${date}T12:00:00`))
}
