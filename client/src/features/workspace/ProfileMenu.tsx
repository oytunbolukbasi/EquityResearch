import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, LogOut, Moon, RotateCcw, Save, Rows3, User } from 'lucide-react'

import { useSession } from '@/lib/session'
import { useTheme } from '@/lib/theme'
import { useDensity } from '@/lib/density'

/**
 * Account menu — and, since GÖREV 46, every panel-level setting.
 *
 * The header used to carry four icon buttons beside the name: reset layout,
 * save layout, row density, theme. Four unlabelled glyphs asked the reader to
 * remember what each one meant, and they were the same weight as the tab strip
 * they sat above — chrome competing with navigation.
 *
 * They are all settings for the panel as a whole, which is exactly what this
 * menu already was. So the header keeps only what it needs to say on sight —
 * the date, and who is signed in — and everything else moved one click away.
 *
 * Hand-rolled, same reason as the date picker: a popover is a button, a
 * positioned card and two listeners. `@radix-ui/react-dropdown-menu` is a
 * dependency and `components/ui/dropdown-menu.tsx` exists, but nothing imports
 * either yet.
 */
export function ProfileMenu({
  onResetLayout,
  onSaveLayout,
  layoutSaved,
}: {
  onResetLayout: () => void
  onSaveLayout: () => void
  /** True for a moment after a save, so the row can confirm it landed. */
  layoutSaved: boolean
}) {
  const { authenticated, username, logout } = useSession()
  const { theme, toggle: toggleTheme } = useTheme()
  const { density, toggle: toggleDensity } = useDensity()

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

  const isDark = theme === 'dark'
  const isCompact = density === 'compact'

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
        <User className="size-[15px] shrink-0 sm:hidden" />
        <span className="hidden max-w-[140px] truncate text-[12px] sm:inline">{username}</span>
        <ChevronDown className="size-[13px] shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="menu"
            aria-label="Ayarlar"
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 300 }}
            className="border-faint bg-card min-w-[248px] rounded-xl border p-1.5 shadow-lg"
          >
            <div className="text-mid truncate px-2.5 pt-1.5 pb-2 text-[12px]">{username}</div>

            {/* Actions close the menu: they are one-shot and the result shows
                elsewhere on the page. */}
            <MenuItem
              icon={<Save className="size-[15px] shrink-0" />}
              label="Düzeni kaydet"
              right={
                layoutSaved ? (
                  <Check className="size-[15px]" style={{ color: 'var(--up)' }} />
                ) : undefined
              }
              onClick={() => {
                onSaveLayout()
                setOpen(false)
              }}
            />
            <MenuItem
              icon={<RotateCcw className="size-[15px] shrink-0" />}
              label="Düzeni sıfırla"
              onClick={() => {
                onResetLayout()
                setOpen(false)
              }}
            />

            <div className="bg-faint my-1.5 h-px" />

            {/* Toggles keep the menu open — you flip one to see what it does,
                and closing on every flip would make comparing them tedious. */}
            <MenuItem
              icon={<Moon className="size-[15px] shrink-0" />}
              label="Koyu tema"
              right={<Switch on={isDark} />}
              onClick={toggleTheme}
            />
            <MenuItem
              icon={<Rows3 className="size-[15px] shrink-0" />}
              label="Satır aralığını sıklaştır"
              right={<Switch on={isCompact} />}
              onClick={toggleDensity}
            />

            <div className="bg-faint my-1.5 h-px" />

            <MenuItem
              icon={<LogOut className="size-[15px] shrink-0" />}
              label="Çıkış yap"
              danger
              onClick={() => {
                setOpen(false)
                void logout()
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}

function MenuItem({
  icon,
  label,
  right,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="hover:bg-faint2 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-[13px] transition-colors"
      style={danger ? { color: 'var(--down)' } : undefined}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {right}
    </button>
  )
}

/** Reads state, not action — the label says what the setting is, this says whether it is on. */
function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[18px] w-[32px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? 'var(--info)' : 'var(--faint)' }}
    >
      <span
        className="absolute top-[2px] size-[14px] rounded-full transition-[left]"
        style={{ left: on ? 16 : 2, background: 'var(--card)' }}
      />
    </span>
  )
}
