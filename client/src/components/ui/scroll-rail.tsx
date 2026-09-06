import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A horizontally scrolling row that says where it is.
 *
 * The edge fades are the whole point: a card clipped by the viewport reads as
 * "there is more this way", but only while there IS more. Left at the end of
 * the rail, the fade sits on top of a card that is in fact fully visible and
 * makes it look cut — so each fade appears only when that direction can still
 * be scrolled.
 *
 * Dragging is for mice. Touch already has native momentum scrolling and
 * re-implementing it would be worse; a trackpad's two-finger swipe is a scroll
 * event and needs nothing. What was missing was grabbing the row with a mouse,
 * which is why the cursor advertises it.
 */
export function ScrollRail({
  children,
  className = '',
  /** Painted under the fades — must match the surface the rail sits on. */
  fadeColor = 'var(--bg)',
}: {
  children: React.ReactNode
  className?: string
  fadeColor?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true, overflowing: false })
  const [dragging, setDragging] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // A pixel of slack: fractional layouts never land exactly on the end.
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft >= max - 1,
      overflowing: max > 1,
    })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // Cards appear and disappear with the data, so the rail can start or stop
    // overflowing without any scroll or resize happening.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [measure, children])

  /**
   * Pointer capture, not plain listeners: without it the browser starts its own
   * text-selection drag over the cards and swallows the moves — the same trap
   * the panel divider hit.
   */
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || !edges.overflowing) return

    // Without this the browser starts its own text-selection drag over the
    // cards and the row never moves — the pointer events still fire, so the
    // handler looks like it is working while the selection eats the gesture.
    e.preventDefault()

    const startX = e.clientX
    const startLeft = el.scrollLeft
    let moved = false
    const { pointerId } = e

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      // A few pixels of slop so a plain click on a card is not a drag.
      if (!moved && Math.abs(dx) < 3) return
      moved = true
      setDragging(true)
      el.scrollLeft = startLeft - dx
    }
    const finish = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      try {
        el.releasePointerCapture(pointerId)
      } catch {
        /* already released */
      }
      setDragging(false)
    }

    try {
      el.setPointerCapture(pointerId)
    } catch {
      /* not capturable — the listeners below still work */
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
  }

  const fade = (side: 'left' | 'right', shown: boolean) => (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 bottom-0 w-14 transition-opacity duration-200"
      style={{
        [side]: 0,
        opacity: shown ? 1 : 0,
        background: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, ${fadeColor} 22%, transparent)`,
      }}
    />
  )

  return (
    <div className="relative">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        className={`eqr-rail flex overflow-x-auto ${className}`}
        style={{
          cursor: edges.overflowing ? (dragging ? 'grabbing' : 'grab') : undefined,
          // Selecting text mid-drag turns the gesture into a highlight.
          userSelect: dragging ? 'none' : undefined,
        }}
      >
        {children}
      </div>
      {fade('left', edges.overflowing && !edges.start)}
      {fade('right', edges.overflowing && !edges.end)}
    </div>
  )
}
