import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import { useMediaQuery } from '@/lib/use-media-query'

/** Tabs that own a resizable split. `reader` has no swap (TOC ↔ article are not interchangeable). */
export type SplitKey = 'overview' | 'reader' | 'ideas' | 'virtual' | 'analytics'
export type SwapKey = Extract<SplitKey, 'overview' | 'ideas' | 'virtual' | 'analytics'>

const SPLITS_KEY = 'eqr2:splits:v2'
const SWAPPED_KEY = 'eqr2:swapped'

/** The only widths a split may come to rest at. Mid-drag values are transient. */
const PRESETS = [25, 50, 75] as const
/** Visual drag bounds — the pointer may roam here, but release still snaps to a preset. */
const MIN_FRAC = 15
const MAX_FRAC = 85

/** Below this the split collapses to one column and every drag interaction is off. */
export const STACK_QUERY = '(max-width: 800px)'

// `virtual` opens wide: its table carries eight columns, while the form beside
// it is a single narrow column.
const DEFAULT_SPLITS: Record<SplitKey, number> = {
  overview: 50,
  reader: 25,
  ideas: 50,
  virtual: 75,
  analytics: 50,
}
const DEFAULT_SWAPPED: Record<SwapKey, boolean> = { overview: false, ideas: false }

function readStore<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / quota — the in-memory value still applies for this session */
  }
}

function nearestPreset(value: number): number {
  return PRESETS.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a))
}

// ─── shared layout store ─────────────────────────────────────────────────────
// Each SplitPane owns its own split/swap state, which keeps the component
// self-contained — but the header's Kaydet / Sıfırla buttons have to read and
// replace all of it at once. This tiny store bridges the two: localStorage is
// the source of truth, and panes re-read it when someone signals a change.

export interface WorkspaceLayout {
  splits: Record<SplitKey, number>
  swapped: Record<SwapKey, boolean>
}

const subscribers = new Set<() => void>()

/** Current layout as persisted, defaults filled in for anything missing. */
export function readWorkspaceLayout(): WorkspaceLayout {
  return {
    splits: readStore(SPLITS_KEY, DEFAULT_SPLITS),
    swapped: readStore(SWAPPED_KEY, DEFAULT_SWAPPED),
  }
}

/** Persist a whole layout and pull every mounted pane onto it. */
export function applyWorkspaceLayout(next: WorkspaceLayout) {
  writeStore(SPLITS_KEY, next.splits)
  writeStore(SWAPPED_KEY, next.swapped)
  for (const fn of subscribers) fn()
}

export function resetWorkspaceLayout() {
  applyWorkspaceLayout({ splits: { ...DEFAULT_SPLITS }, swapped: { ...DEFAULT_SWAPPED } })
}

/**
 * True when `value` is a layout this version wrote. The `layouts` table still
 * holds rows from the old react-grid-layout dashboard, and restoring one of
 * those would put nonsense into the split widths.
 */
export function isWorkspaceLayout(value: unknown): value is WorkspaceLayout {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<WorkspaceLayout>
  if (typeof v.splits !== 'object' || v.splits === null) return false
  if (typeof v.swapped !== 'object' || v.swapped === null) return false
  return (Object.keys(DEFAULT_SPLITS) as SplitKey[]).every(
    (k) => typeof (v.splits as Record<string, unknown>)[k] === 'number',
  )
}

/**
 * Runs a pointer drag against the element that was pressed, using pointer
 * capture rather than window listeners.
 *
 * Capture matters here: without it the browser is free to start its own gesture
 * (text selection over a panel heading, a native element drag) the moment the
 * pointer leaves the pressed element, and the moves that follow never reach us —
 * the drag silently does nothing. Capture also guarantees `pointerup` arrives
 * even if the pointer ends up over an iframe or outside the window.
 */
function capturePointer(
  e: React.PointerEvent,
  handlers: { move: (ev: PointerEvent) => void; end: () => void },
): () => void {
  const el = e.currentTarget as HTMLElement
  const { pointerId } = e

  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* pointer already gone — the listeners below still see the up/cancel */
  }

  const finish = () => {
    el.removeEventListener('pointermove', handlers.move)
    el.removeEventListener('pointerup', finish)
    el.removeEventListener('pointercancel', finish)
    try {
      el.releasePointerCapture(pointerId)
    } catch {
      /* already released by the browser */
    }
    handlers.end()
  }

  el.addEventListener('pointermove', handlers.move)
  el.addEventListener('pointerup', finish)
  el.addEventListener('pointercancel', finish)
  return finish
}

// ─── swap handle plumbing ────────────────────────────────────────────────────
// SplitPane publishes a grab handler; the Panel headers inside it consume one.
// Keeps Panel free of any knowledge about which split it lives in.

interface SwapContextValue {
  enabled: boolean
  onGrab: (side: 'a' | 'b', e: React.PointerEvent) => void
}

const SwapCtx = createContext<SwapContextValue>({ enabled: false, onGrab: () => {} })

export function useSwapHandle(side: 'a' | 'b') {
  const { enabled, onGrab } = useContext(SwapCtx)
  if (!enabled) return {}
  return {
    onPointerDown: (e: React.PointerEvent) => onGrab(side, e),
    // touchAction:none stops the browser claiming the gesture as a scroll/pan
    // before our pointermove handler ever sees it.
    style: { cursor: 'grab' as const, touchAction: 'none' as const },
    title: 'Sürükle: panellerin yerini değiştir',
  }
}

// ─── split pane ──────────────────────────────────────────────────────────────

interface SplitPaneProps {
  /** Which persisted split/swap slot this pane owns. */
  splitKey: SplitKey
  /** Panel A — the one whose width the stored percentage describes, wherever it sits. */
  a: React.ReactNode
  /** Panel B — always takes the remaining space (`flex: 1`). */
  b: React.ReactNode
  /** Off for `reader`: the two sides are not interchangeable there. */
  swappable?: boolean
}

/**
 * Two panels with a draggable divider between them.
 *
 * Width follows the pointer freely while dragging (with 25/50/75 guides shown),
 * then snaps to the nearest preset on release — so the persisted value is always
 * exactly 25, 50 or 75.
 *
 * Swapping is driven from the panel headers (see `useSwapHandle`): the moment the
 * pointer crosses the divider the two panels trade places, with no transition.
 * DOM order stays fixed and only `order` changes, so neither panel remounts —
 * scroll position, chart instances and local state all survive the swap.
 */
export function SplitPane({ splitKey, a, b, swappable = true }: SplitPaneProps) {
  const stacked = useMediaQuery(STACK_QUERY)
  const containerRef = useRef<HTMLDivElement>(null)

  const [split, setSplit] = useState(() => readStore(SPLITS_KEY, DEFAULT_SPLITS)[splitKey])
  const [swapped, setSwapped] = useState(
    () => swappable && readStore(SWAPPED_KEY, DEFAULT_SWAPPED)[splitKey as SwapKey],
  )
  const [dragging, setDragging] = useState(false)

  // Pointer handlers run inside listener closures that outlive a render, so they
  // read live values through refs rather than the captured state.
  const splitRef = useRef(split)
  const swappedRef = useRef(swapped)
  splitRef.current = split
  swappedRef.current = swapped

  // Pointer-fraction across the container, 0-100 from its left edge.
  const fractionAt = useCallback((clientX: number): number | null => {
    const el = containerRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0) return null
    return ((clientX - r.left) / r.width) * 100
  }, [])

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (stacked) return
      e.preventDefault()
      setDragging(true)
      document.body.classList.add('eqr-dragging')

      capturePointer(e, {
        move: (ev) => {
          const raw = fractionAt(ev.clientX)
          if (raw == null) return
          const frac = Math.min(MAX_FRAC, Math.max(MIN_FRAC, raw))
          // When swapped, panel A sits on the right — its width is the mirror of
          // the pointer's distance from the left edge.
          setSplit(swappedRef.current ? 100 - frac : frac)
        },
        end: () => {
          document.body.classList.remove('eqr-dragging')
          setDragging(false)
          setSplit((cur) => {
            const snapped = nearestPreset(cur)
            const all = readStore(SPLITS_KEY, DEFAULT_SPLITS)
            writeStore(SPLITS_KEY, { ...all, [splitKey]: snapped })
            return snapped
          })
        },
      })
    },
    [fractionAt, splitKey, stacked],
  )

  const onGrab = useCallback(
    (side: 'a' | 'b', e: React.PointerEvent) => {
      if (stacked || !swappable) return
      // Controls inside the header keep their own click behaviour — grabbing the
      // header must not hijack a select, a button or a link.
      if ((e.target as HTMLElement).closest('button, select, input, textarea, a')) return
      e.preventDefault()
      document.body.classList.add('eqr-dragging')

      capturePointer(e, {
        move: (ev) => {
          const frac = fractionAt(ev.clientX)
          if (frac == null) return
          const dividerPos = swappedRef.current ? 100 - splitRef.current : splitRef.current
          const grabbedIsLeft = side === 'a' ? !swappedRef.current : swappedRef.current
          const crossed = grabbedIsLeft ? frac > dividerPos : frac < dividerPos
          if (!crossed) return
          setSwapped((prev) => {
            const next = !prev
            const all = readStore(SWAPPED_KEY, DEFAULT_SWAPPED)
            writeStore(SWAPPED_KEY, { ...all, [splitKey]: next })
            return next
          })
        },
        end: () => document.body.classList.remove('eqr-dragging'),
      })
    },
    [fractionAt, splitKey, stacked, swappable],
  )

  // A stray class left behind by an unmount mid-drag would lock text selection.
  useEffect(() => () => document.body.classList.remove('eqr-dragging'), [])

  // Follow whole-layout replacements (Sıfırla, or a restore from the DB).
  useEffect(() => {
    const sync = () => {
      const layout = readWorkspaceLayout()
      setSplit(layout.splits[splitKey])
      setSwapped(swappable && !!layout.swapped[splitKey as SwapKey])
    }
    subscribers.add(sync)
    return () => {
      subscribers.delete(sync)
    }
  }, [splitKey, swappable])

  if (stacked) {
    return (
      <div className="eqr-split flex flex-col gap-4">
        <SwapCtx.Provider value={{ enabled: false, onGrab: () => {} }}>
          {a}
          {b}
        </SwapCtx.Provider>
      </div>
    )
  }

  return (
    <SwapCtx.Provider value={{ enabled: swappable, onGrab }}>
      <div ref={containerRef} className="eqr-split relative flex items-stretch">
        <div
          className="min-w-0"
          style={{ flex: `0 0 calc(${split}% - 6px)`, order: swapped ? 3 : 1 }}
        >
          {a}
        </div>

        <div
          onPointerDown={startResize}
          title="Sürükle: %25 / %50 / %75"
          role="separator"
          aria-orientation="vertical"
          aria-label="Panel genişliğini ayarla"
          className="eqr-divider flex shrink-0 cursor-col-resize items-center justify-center"
          style={{ flex: '0 0 12px', order: 2, touchAction: 'none' }}
        >
          <div className="eqr-divider-grip h-11 w-[3px] rounded-full" />
        </div>

        <div className="min-w-0" style={{ flex: 1, order: swapped ? 1 : 3 }}>
          {b}
        </div>

        {/* Snap guides — only while the divider is being dragged. */}
        {dragging && (
          <div className="pointer-events-none absolute inset-0">
            {PRESETS.map((p) => (
              <div
                key={p}
                className="absolute top-0 bottom-0 border-l border-dashed opacity-50"
                style={{ left: `${p}%`, borderColor: 'var(--info)' }}
              />
            ))}
          </div>
        )}
      </div>
    </SwapCtx.Provider>
  )
}
