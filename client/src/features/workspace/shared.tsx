import { Loader2 } from 'lucide-react'

export function Loading() {
  return (
    <div className="flex h-32 items-center justify-center">
      <Loader2 className="text-mid size-5 animate-spin" />
    </div>
  )
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center px-4 text-center">
      <p className="text-mid text-sm">{children}</p>
    </div>
  )
}

/** Colour pairs for the four portfolio action verbs the cowork agent emits. */
export const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  BEKLE: { bg: 'var(--info-tint)', color: 'var(--info)' },
  'KISMİ KÂR AL': { bg: 'var(--up-tint)', color: 'var(--up)' },
  SAT: { bg: 'var(--down-tint)', color: 'var(--down)' },
  'POZİSYON ARTIR': { bg: 'var(--tp3-tint)', color: 'var(--tp3)' },
}

export function actionStyle(action: string) {
  return ACTION_STYLE[action] ?? { bg: 'var(--neutral-tint)', color: 'var(--mid)' }
}

export function ActionBadge({ action }: { action: string }) {
  const s = actionStyle(action)
  return (
    <span
      className="num inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {action}
    </span>
  )
}

export interface TabItem<T extends string> {
  id: T
  label: string
}

/** Underline tabs — used inside panels (Fikirler, Paper Trading). */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  className = '',
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={`border-faint flex shrink-0 gap-3.5 border-b px-[18px] ${className}`}>
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-0.5 pt-0 pb-2.5 text-xs font-medium transition-colors"
          style={{
            borderBottomColor: value === t.id ? 'var(--info)' : 'transparent',
            color: value === t.id ? 'var(--info)' : 'var(--mid)',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Pill tabs — used for the Portföy panel's sub-sections. */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1.5 px-[18px] pb-3">
      {items.map((t) => {
        const on = value === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium transition-colors"
            style={{
              borderColor: on ? 'var(--info)' : 'var(--faint)',
              background: on ? 'var(--info-tint)' : 'transparent',
              color: on ? 'var(--info)' : 'var(--mid)',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
