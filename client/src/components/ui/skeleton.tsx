/**
 * Loading placeholders.
 *
 * A spinner says "something is happening"; a skeleton says "this is what is
 * coming, and it will land here". That matters on this panel because the tabs
 * were doing something worse than either: Genel bakış rendered its KPI cards
 * from an empty array, so the first thing a reader saw was **₺0,00** — a real
 * number, wrong — and the bulletin panel said "Henüz bülten eklenmedi" while
 * the bulletin was still in flight.
 *
 * Rules kept by every caller:
 * - Static chrome (tab strip, headings, panel titles, pill tabs) renders at
 *   once. Only the parts that wait on data become blocks.
 * - A block carries the size of the thing it replaces, so nothing jumps when
 *   the data lands.
 * - No number and no empty-state text while loading. "Kayıt yok" is an answer,
 *   and we don't have one yet.
 * - First load only. `useApi` sets `loading` on mount, not on refetch, so a
 *   background refresh keeps the data that is already on screen.
 */

export function Skeleton({
  w,
  h = 11,
  radius,
  className = '',
}: {
  /** Any CSS width — a number is px. Percentages vary the line lengths. */
  w?: number | string
  h?: number
  radius?: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`eqr-sk block ${className}`}
      style={{ width: w, height: h, borderRadius: radius }}
    />
  )
}

/** A paragraph's worth of lines; the last one is short, the way text ends. */
export function SkeletonLines({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  const widths = ['96%', '88%', '92%', '80%', '86%']
  return (
    <span className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={9} w={i === lines - 1 ? '55%' : widths[i % widths.length]} />
      ))}
    </span>
  )
}

/**
 * One KPI card's worth of blocks: label, value, delta — the card keeps its own
 * height so the rail doesn't resize when the numbers arrive.
 */
export function SkeletonKpi() {
  // Measured against the real card, not eyeballed: 264×125, padding 16/18,
  // rows of 18 / 39 (with 8px margins) / 18. A shorter block would let the rail
  // grow by 30px the moment the numbers land, which is the jump skeletons
  // exist to prevent.
  return (
    <article className="bg-card border-faint w-[264px] shrink-0 rounded-xl border px-[18px] py-4">
      <span className="flex h-[18px] items-center">
        <Skeleton h={10} w="62%" />
      </span>
      <span className="my-2 flex h-[39px] items-center">
        <Skeleton h={24} w="78%" />
      </span>
      <span className="flex h-[18px] items-center">
        <Skeleton h={10} w="48%" />
      </span>
    </article>
  )
}

/**
 * Table rows. `cols` blocks per row, the first one left-aligned and the rest
 * pushed right, which is how every table in the panel is laid out.
 */
export function SkeletonRows({
  rows = 6,
  cols = 3,
  className = '',
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  // Deterministic, not random: a skeleton that re-randomises on every render
  // flickers, and these re-render on every parent state change.
  const widths = [58, 42, 50, 46, 62, 38]
  return (
    <div className={className}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="border-faint2 flex items-center gap-3 border-b px-[18px] py-3.5">
          <Skeleton w={widths[r % widths.length]} />
          <span className="ml-auto flex items-center gap-3">
            {Array.from({ length: cols - 1 }, (_, c) => (
              <Skeleton key={c} w={widths[(r + c + 2) % widths.length]} />
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * The phone's position cards: symbol over type on the left, value over P/L on
 * the right. Same two-line shape and padding as `PositionCard`, so the list
 * keeps its height when the rows arrive.
 */
export function SkeletonCards({ rows = 6 }: { rows?: number }) {
  const widths = [54, 44, 60, 48, 52, 40]
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="border-faint2 flex items-start justify-between gap-3 border-b px-4 py-3 last:border-b-0"
        >
          <span className="flex flex-col gap-1.5">
            <Skeleton h={13} w={widths[i % widths.length]} />
            <Skeleton h={10} w={widths[(i + 2) % widths.length] + 26} />
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <Skeleton h={13} w={72} />
            <Skeleton h={10} w={56} />
          </span>
        </div>
      ))}
    </div>
  )
}
