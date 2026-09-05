import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, LogOut, User } from 'lucide-react'

import { useSession } from '@/lib/session'

/**
 * Account menu in the app header.
 *
 * The session gates one tab, but it belongs to the whole panel. Parking the
 * username and logout inside Sanal Portföy's heading made them read as that
 * tab's own controls, and crowded a row that already carried the freshness
 * label and the refresh button.
 *
 * Renders nothing until there is a session, so the header looks the same as it
 * always did for anyone who has not signed in.
 *
 * Hand-rolled for the same reason as the date picker: a popover with a single
 * item is a button, a positioned card and two listeners. `@radix-ui/react-
 * dropdown-menu` is a dependency and `components/ui/dropdown-menu.tsx` exists,
 * but nothing imports either yet — this one item is not the reason to start
 * shipping them.
 */
export function ProfileMenu() {
  const { authenticated, username, logout } = useSession()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The header collapses on scroll, which moves the trigger out from under a
  // menu measured against its old position.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!authenticated) return null

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
    }
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={username ?? 'Hesap'}
        className="border-faint bg-card text-mid hover:bg-faint2 hover:text-ink inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2 transition-colors sm:pl-3"
      >
        {/* Icon only where the name cannot be shown — beside the name it says
            nothing the name doesn't, and without it the phone trigger would be
            a lone chevron. */}
        <User className="size-[15px] shrink-0 sm:hidden" />
        {/* The name is the point of the control, but a phone header has no room
            for it beside four icon buttons. */}
        <span className="hidden max-w-[140px] truncate text-[12px] sm:inline">{username}</span>
        <ChevronDown className="size-[13px] shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="menu"
            aria-label="Hesap"
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 300 }}
            className="border-faint bg-card min-w-[180px] rounded-xl border p-1.5 shadow-lg"
          >
            {/* On a phone the trigger shows no name, so the menu carries it. */}
            <div className="text-mid truncate px-2.5 pt-1 pb-2 text-[12px] sm:hidden">
              {username}
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void logout()
              }}
              className="hover:bg-faint2 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-[13px] font-medium transition-colors"
              style={{ color: 'var(--down)' }}
            >
              <LogOut className="size-[15px] shrink-0" />
              Çıkış yap
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
