/**
 * `left` for a fixed popover whose right edge lines up with its trigger's.
 *
 * Popovers used to be placed with `right: window.innerWidth - rect.right`.
 * That mixes two coordinate systems: the rect is in layout-viewport CSS px,
 * `innerWidth` is not always — Safari with page zoom reports a width that
 * disagrees with the rects, and the profile menu opened ~77px right of its
 * button, half off-screen. Taking the trigger's own right edge and subtracting
 * the popover's width keeps everything in the rect's coordinates; the viewport
 * width is only used to keep the card on-screen near an edge.
 */
export function endAlignedLeft(anchor: DOMRect, width: number, margin = 8): number {
  const vw = document.documentElement.clientWidth
  return Math.max(margin, Math.min(anchor.right - width, vw - width - margin))
}

/** The popover width to use on this screen: `width`, or the viewport less margins. */
export function fitWidth(width: number, margin = 12): number {
  return Math.min(width, document.documentElement.clientWidth - margin * 2)
}
