import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastCtx = createContext<ToastValue>({
  success: () => {},
  error: () => {},
  info: () => {},
})

const VISIBLE_MS = 3000

const KIND_STYLE: Record<ToastKind, { bg: string; color: string }> = {
  success: { bg: 'var(--up-tint)', color: 'var(--up)' },
  error: { bg: 'var(--down-tint)', color: 'var(--down)' },
  info: { bg: 'var(--info-tint)', color: 'var(--info)' },
}

/**
 * Small pill notifications for actions that otherwise leave no trace.
 *
 * Writing to the portfolio used to succeed silently — the row simply changed
 * and you had to infer it worked. These confirm what happened, in the same pill
 * shape the old PortfoyTakip app used, moved to the top right.
 *
 * Portalled to <body> so a toast is never clipped by a panel's overflow.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, kind, message }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), VISIBLE_MS),
      )
    },
    [dismiss],
  )

  const value: ToastValue = {
    success: useCallback((m: string) => push('success', m), [push]),
    error: useCallback((m: string) => push('error', m), [push]),
    info: useCallback((m: string) => push('info', m), [push]),
  }

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed top-4 right-4 z-[200] flex flex-col items-end gap-2"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => {
            const style = KIND_STYLE[t.kind]
            return (
              <div
                key={t.id}
                className="eqr-toast pointer-events-auto flex max-w-[min(90vw,28rem)] items-center gap-3 rounded-full py-2.5 pr-2.5 pl-[18px] text-[14px] font-medium shadow-lg"
                style={{
                  background: style.bg,
                  color: style.color,
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'blur(12px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
                }}
              >
                <span>{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Bildirimi kapat"
                  className="shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-1.5 leading-none opacity-60 transition-opacity hover:opacity-100"
                  style={{ color: 'inherit', fontSize: 17 }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastValue {
  return useContext(ToastCtx)
}
