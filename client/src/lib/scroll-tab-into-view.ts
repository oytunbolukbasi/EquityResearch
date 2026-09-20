/**
 * Scrolls a horizontal strip just far enough to show the selected item.
 *
 * Tab strips overflow on a phone, and the last tab is the one that gets cut:
 * selecting "Bekleyen Emirler" left it reading "Bekleyen Emirle…" against the
 * right edge, with the underline half off-screen.
 *
 * Only the strip's own `scrollLeft` moves. `scrollIntoView` would have been one
 * line, but it walks up every scrollable ancestor — including the page — so
 * picking a tab could also scroll the article underneath it.
 */
export function scrollTabIntoView(strip: HTMLElement | null, item: HTMLElement | null) {
  if (!strip || !item) return

  // A little past the edge, so the tab doesn't sit flush against it and still
  // look clipped.
  const margin = 12

  // Measured with rects, not `offsetLeft`: offsets are relative to the nearest
  // positioned ancestor, which here is the panel, not the strip. With the panel
  // as the origin the first tab's offset was larger than the strip's own
  // scrollLeft, so selecting it scrolled to the wrong place and left it cut.
  const strip_ = strip.getBoundingClientRect()
  const item_ = item.getBoundingClientRect()

  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'

  if (item_.right > strip_.right) {
    strip.scrollBy({ left: item_.right - strip_.right + margin, behavior })
  } else if (item_.left < strip_.left) {
    strip.scrollBy({ left: item_.left - strip_.left - margin, behavior })
  }
}
