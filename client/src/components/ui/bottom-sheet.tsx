import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet for the phone layout.
 *
 * Chosen over a full-screen page because the sheet is always reached FROM a
 * row: keeping that row dimly visible behind it is what tells you which
 * position you are acting on, and swiping a sheet away is quicker than finding
 * a back button. The scrim is tappable for the same reason.
 *
 * `footer` is pinned below the scrolling body — actions must not scroll out of
 * reach on a short screen.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean
  title: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // The page behind must not scroll while the sheet owns the screen —
    // otherwise a flick on the scrim scrolls the list underneath instead.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="eqr-sheet-wrap fixed inset-0 z-[400] flex flex-col justify-end">
      <div
        className="absolute inset-0"
        style={{ background: 'var(--scrim)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card border-faint relative flex max-h-[88vh] flex-col rounded-t-[22px] border-t"
      >
        {/* Grab handle — no drag behind it yet, but it reads as "pull me down"
            and marks the top edge of the sheet against the blurred list. */}
        <div
          className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full"
          style={{ background: 'var(--faint)' }}
          aria-hidden="true"
        />

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-1">
          <h2 className="m-0 truncate text-[17px] font-medium tracking-[-0.25px]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="text-mid hover:text-ink -m-2 shrink-0 cursor-pointer border-0 bg-transparent p-2 text-[20px] leading-none"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">{children}</div>

        {footer && (
          <div
            className="border-faint2 shrink-0 border-t px-4 pt-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
