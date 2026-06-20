import { createContext, useContext, useEffect } from 'react'

export const WidgetSubtitleCtx = createContext<((s: string) => void) | null>(null)

export function useWidgetSubtitle(subtitle: string | null | undefined) {
  const set = useContext(WidgetSubtitleCtx)
  useEffect(() => {
    if (set) set(subtitle ?? '')
  }, [set, subtitle])
}

export function fmtDataDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = value.includes('T') || value.includes('Z')
    ? new Date(value)
    : new Date(value + 'T12:00:00')
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' kapanışı'
}
