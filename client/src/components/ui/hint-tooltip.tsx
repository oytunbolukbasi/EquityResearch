import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { endAlignedLeft, fitWidth } from '@/lib/anchor'

/**
 * A small icon that opens an explanation on click (and tap — there is no hover
 * on a phone, which is why this is not a hover tooltip).
 *
 * Portalled and `fixed` so a panel's `overflow: auto` can't clip it — the same
 * reason the Risk/Getiri tooltip was written that way (GÖREV 22). Placed under
 * the trigger, right-aligned to it, and pulled back inside the viewport so a
 * trigger near the left edge doesn't push the card off-screen.
 */
export function HintTooltip({
  icon,
  label,
  width = 280,
  align = 'end',
  className = '',
  children,
}: {
  icon: React.ReactNode
  /** Accessible name for the trigger — what the explanation is about. */
  label: string
  width?: number
  /**
   * Which edge of the card lines up with the trigger. `end` (default) opens
   * leftwards — right for a column header at a table's right side. `start`
   * opens rightwards — for a trigger at the start of a panel, where `end`
   * would lay the card over the neighbouring panel.
   */
  align?: 'start' | 'end'
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (!tipRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    // Scrolling moves the trigger away from where the card was measured.
    const dismiss = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect()
            const w = fitWidth(width)
            const vw = document.documentElement.clientWidth
            const left =
              align === 'start' ? Math.max(12, Math.min(r.left, vw - w - 12)) : endAlignedLeft(r, w, 12)
            setPos({ top: r.bottom + 6, left })
          }
          setOpen((v) => !v)
        }}
        className={`inline-flex cursor-pointer items-center border-0 bg-transparent p-0 align-middle leading-none ${className}`}
      >
        {icon}
      </button>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: fitWidth(width) }}
            className="border-faint bg-card rounded-lg border p-3 text-[12px] leading-relaxed shadow-lg"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}
