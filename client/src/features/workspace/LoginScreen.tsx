import { useState } from 'react'
import { BotMessageSquare } from 'lucide-react'

import { useSession } from '@/lib/session'

/**
 * The panel's front door.
 *
 * It used to live inside the Sanal Portföy tab, because that tab was the only
 * thing a session protected — everything else was readable by anyone with the
 * URL. Now one session covers the whole panel, so the form belongs at the root:
 * a door on one room is not much use when the rest of the house is open.
 *
 * No "forgot password" and no sign-up: there is one account, its hash lives in
 * an environment variable, and it is rotated from a terminal with
 * `scripts/hash-password.mjs`.
 */
export function LoginScreen() {
  const { login } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await login(username, password))
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="bg-card border-faint w-full max-w-sm rounded-[14px] border p-7">
        <div className="mb-6 flex items-center gap-2">
          <BotMessageSquare size={22} className="text-info" aria-hidden="true" />
          <span className="text-[19px] font-medium tracking-[-0.5px]">EQR</span>
        </div>

        <h1 className="m-0 mb-1 text-[15px] font-medium tracking-[-0.25px]">Giriş</h1>
        <p className="text-mid mt-0 mb-5 text-xs leading-[1.6]">
          Panel kişisel bir takip aracı — devam etmek için giriş yapın.
        </p>

        <label className="mb-3 block">
          <span className="text-mid mb-1 block text-[12px]">Kullanıcı adı</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="num border-faint bg-card text-ink focus:border-info w-full rounded-lg border px-2.5 py-1.5 text-[16px] outline-none sm:text-[13px]"
          />
        </label>
        <label className="mb-3 block">
          <span className="text-mid mb-1 block text-[12px]">Parola</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="num border-faint bg-card text-ink focus:border-info w-full rounded-lg border px-2.5 py-1.5 text-[16px] outline-none sm:text-[13px]"
          />
        </label>

        {error && (
          <p className="mb-3 text-xs leading-[1.6]" style={{ color: 'var(--down)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full cursor-pointer rounded-lg border-0 bg-[var(--ink)] px-3 py-3 text-[15px] font-medium text-[var(--card)] transition-opacity hover:opacity-85 disabled:opacity-50 sm:py-2 sm:text-[13px]"
        >
          {busy ? 'Kontrol ediliyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  )
}
