import { useEffect, useState } from 'react'

/**
 * "Kaydedildi", then gone.
 *
 * Autosave's problem is that it is invisible: you stop typing and nothing tells
 * you the work is safe. A permanent label would be worse — a status that never
 * changes stops being read, and then it cannot report a failure either.
 *
 * So it appears on each save and dissolves. `at` is a timestamp rather than a
 * boolean because two saves in a row must restart the fade; a boolean flipping
 * true→true is not a change React can see.
 */
export function SavedFlash({ at }: { at: number }) {
  const [state, setState] = useState<'hidden' | 'in' | 'out'>('hidden')

  useEffect(() => {
    if (!at) return
    setState('in')
    const fade = setTimeout(() => setState('out'), 1200)
    const done = setTimeout(() => setState('hidden'), 1800)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [at])

  if (state === 'hidden') return null

  return (
    <span
      role="status"
      className="num text-[12px] transition-opacity duration-500"
      style={{ color: 'var(--mid)', opacity: state === 'in' ? 1 : 0 }}
    >
      Kaydedildi
    </span>
  )
}
