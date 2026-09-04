import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface SessionValue {
  authenticated: boolean
  username: string | null
  /** null while the initial /auth/me check is in flight. */
  loading: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const SessionCtx = createContext<SessionValue>({
  authenticated: false,
  username: null,
  loading: true,
  login: async () => 'not ready',
  logout: async () => {},
})

const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: 'Kullanıcı adı veya parola hatalı.',
  too_many_attempts: 'Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.',
  auth_not_configured: 'Sunucuda giriş yapılandırılmamış (PORTFOLIO_AUTH_HASH eksik).',
  invalid_body: 'Kullanıcı adı ve parola gerekli.',
}

/**
 * Session state for the Sanal Portföy tab.
 *
 * The session itself lives in an httpOnly cookie the browser attaches on its
 * own, so nothing here holds a token — this only tracks whether the server
 * currently recognises us, which is what decides between the login form and the
 * management UI.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { authenticated?: boolean; username?: string | null } | null) => {
        if (cancelled) return
        setUsername(d?.authenticated ? (d.username ?? null) : null)
      })
      .catch(() => {
        /* offline — treat as signed out */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Resolves to null on success, or a human-readable message on failure. */
  const login = useCallback(async (user: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; username?: string }
      if (!res.ok) return LOGIN_ERRORS[data.error ?? ''] ?? 'Giriş yapılamadı.'
      setUsername(data.username ?? user)
      return null
    } catch {
      return 'Sunucuya ulaşılamadı.'
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUsername(null)
  }, [])

  return (
    <SessionCtx.Provider
      value={{ authenticated: username != null, username, loading, login, logout }}
    >
      {children}
    </SessionCtx.Provider>
  )
}

export function useSession(): SessionValue {
  return useContext(SessionCtx)
}
