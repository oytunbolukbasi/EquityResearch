import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ConfirmOptions {
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button, for actions that destroy data. */
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmCtx = createContext<ConfirmFn>(async () => false)

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/**
 * In-app confirmation dialog, replacing `window.confirm`.
 *
 * The native dialog was the wrong tool twice over. It ignores the panel's
 * design language, and — the reason this exists — a browser that has been told
 * to block further dialogs for a page returns `false` from `confirm()` without
 * showing anything. The delete then silently did nothing, which read as a dead
 * button rather than a cancelled action.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )

  const close = useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok)
        return null
      })
    },
    [],
  )

  // Focus the confirm button on open so the dialog is operable from the
  // keyboard, and wire Escape to cancel.
  useEffect(() => {
    if (!pending) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, close])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending &&
        createPortal(
          <div
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close(false)
            }}
            className="fixed inset-0 z-[400] flex items-center justify-center p-4"
            style={{ background: 'var(--scrim)' }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={pending.title}
              className="w-full max-w-sm rounded-2xl p-5"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              }}
            >
              <h2 className="m-0 mb-2 text-[15px] font-semibold tracking-[-0.2px]">
                {pending.title}
              </h2>
              {pending.body && (
                <div className="text-mid text-[13px] leading-[1.65]">{pending.body}</div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => close(false)}
                  className="border-faint hover:bg-faint2 text-ink cursor-pointer rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-colors"
                >
                  {pending.cancelLabel ?? 'Vazgeç'}
                </button>
                <button
                  ref={confirmRef}
                  onClick={() => close(true)}
                  className="cursor-pointer rounded-lg border-0 px-3.5 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-85"
                  style={{
                    background: pending.danger ? 'var(--down)' : 'var(--ink)',
                    color: 'var(--card)',
                  }}
                >
                  {pending.confirmLabel ?? 'Onayla'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmCtx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmCtx)
}
