import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query. Mirrors the matchMedia pattern in theme.tsx.
 * Client-side only (Vite CSR), so `window` is always available.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches) // re-sync in case the query changed
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
