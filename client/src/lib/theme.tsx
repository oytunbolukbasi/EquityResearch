import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'eqr:theme'

interface ThemeCtx {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

/** Whether the user has made an explicit choice (vs. following the OS). */
function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function initialTheme(): Theme {
  return storedTheme() ?? (systemPrefersDark() ? 'dark' : 'light')
}

// Reflect the theme onto <html> so the .dark class covers portaled content
// (Radix dropdowns / modals render outside the React root into document.body).
// Applied imperatively — not only via useEffect — so it lands BEFORE child
// effects read getComputedStyle (React runs child effects before parent's, so a
// consumer like TradePlanChart would otherwise read the pre-toggle palette).
function applyClass(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  // Keep <html> in sync on mount (the inline script in index.html already set
  // it pre-render; this is a belt-and-suspenders sync for the React-owned value).
  useLayoutEffect(() => {
    applyClass(theme)
  }, [theme])

  // Follow OS changes only while the user hasn't made an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (!storedTheme()) {
        const next = e.matches ? 'dark' : 'light'
        applyClass(next)
        setThemeState(next)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    applyClass(t) // synchronous, before the re-render commit
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
