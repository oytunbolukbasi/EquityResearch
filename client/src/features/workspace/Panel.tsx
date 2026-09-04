import { useSwapHandle } from './split'

interface PanelProps {
  /** Which half of the SplitPane this panel is rendered into — drives the swap grab. */
  side: 'a' | 'b'
  title: React.ReactNode
  /** Right-hand slot of the header: a count chip, a select, a meta line. */
  right?: React.ReactNode
  /** Rendered flush under the header, outside the padded body (tab strips, etc). */
  belowHeader?: React.ReactNode
  children: React.ReactNode
  /** Caps the body height and scrolls inside it instead of growing the page. */
  maxBodyHeight?: number | string
  /** Off for bodies that own their own padding (full-bleed tables). */
  padded?: boolean
}

/**
 * The card shell every workspace panel shares. Its header doubles as the swap
 * handle — see `useSwapHandle`, which returns nothing when the panel is not in a
 * swappable split (the reader tab, or any stacked mobile layout).
 */
export function Panel({
  side,
  title,
  right,
  belowHeader,
  children,
  maxBodyHeight,
  padded = true,
}: PanelProps) {
  const handle = useSwapHandle(side)

  return (
    <section className="eqr-panel bg-card border-faint flex h-full flex-col rounded-xl border">
      <header
        {...handle}
        className="flex shrink-0 select-none items-center justify-between gap-2 px-[18px] pt-3.5 pb-2.5"
      >
        <h2 className="text-[15px] font-medium tracking-[-0.25px]">{title}</h2>
        {right}
      </header>

      {belowHeader}

      <div
        className={`min-h-0 flex-1 ${maxBodyHeight ? 'overflow-auto' : ''} ${padded ? 'px-[18px] pt-1 pb-[18px]' : ''}`}
        style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
      >
        {children}
      </div>
    </section>
  )
}

/** Small neutral chip used in panel headers for counts and units. */
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="num shrink-0 rounded-[5px] px-[7px] py-[3px] text-[12px]"
      style={{ background: 'var(--neutral-tint)', color: 'var(--mid)' }}
    >
      {children}
    </span>
  )
}

/** Page title block shared by every tab. */
export function TabHeading({
  title,
  subtitle,
  right,
  below,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  /** Full-width strip under the title row, inside the heading's own spacing. */
  below?: React.ReactNode
}) {
  return (
    <div className="mb-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] leading-[1.25] font-medium tracking-[-1px]">{title}</h1>
          {subtitle && <p className="text-mid mt-[5px] mb-0 text-xs">{subtitle}</p>}
        </div>
        {right}
      </div>
      {below && <div className="mt-3">{below}</div>}
    </div>
  )
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-mid px-[22px] py-12 text-center text-xs leading-[1.7]">{children}</div>
  )
}
