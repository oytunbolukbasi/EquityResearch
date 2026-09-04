import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Density = 'comfortable' | 'compact'

const STORAGE_KEY = 'eqr2:density'

interface DensityValue {
  density: Density
  toggle: () => void
}

const DensityCtx = createContext<DensityValue>({ density: 'comfortable', toggle: () => {} })

function read(): Density {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

/**
 * Row density for every table in the workspace. Applied as a `data-density`
 * attribute on <html>, which index.css turns into a `--rowpad` value — so
 * tables pick it up without any per-component wiring.
 *
 * Mirrors ThemeProvider: the attribute is written synchronously on toggle so
 * portalled content (modals, tooltips) sees the same value in the same frame.
 */
export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensity] = useState<Density>(read)

  useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])

  const toggle = useCallback(() => {
    setDensity((prev) => {
      const next: Density = prev === 'compact' ? 'comfortable' : 'compact'
      document.documentElement.dataset.density = next
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* private mode — the choice still applies for this session */
      }
      return next
    })
  }, [])

  return <DensityCtx.Provider value={{ density, toggle }}>{children}</DensityCtx.Provider>
}

export function useDensity(): DensityValue {
  return useContext(DensityCtx)
}
