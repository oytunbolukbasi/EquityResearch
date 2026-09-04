import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query.
 *
 * Reads through `useSyncExternalStore` rather than mirroring the value into
 * state: the answer is re-read from `matchMedia` on every notification, so it
 * cannot drift out of sync with the real viewport.
 *
 * It also listens to `resize` alongside the MediaQueryList's own `change`
 * event. The change event is the correct signal but is not always delivered —
 * an emulated viewport was observed reporting `matches: true` while no change
 * event ever fired, which left the workspace rendering its side-by-side layout
 * on a narrow screen (and, worse, its stacked layout on a wide one, pushing the
 * right-hand panel far below the fold where it looked like a dead button).
 * Re-reading on resize costs nothing and closes that gap.
 *
 * Client-side only (Vite CSR), so `window` is always available.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onStoreChange)
      window.addEventListener('resize', onStoreChange)
      return () => {
        mq.removeEventListener('change', onStoreChange)
        window.removeEventListener('resize', onStoreChange)
      }
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot)
}
