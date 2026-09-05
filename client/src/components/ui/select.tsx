import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

/**
 * Dropdown that matches the panel's own inputs.
 *
 * A native `<select>` cannot be styled past its border: the arrow and the
 * option list are drawn by the OS, so the control sat in the form looking like
 * a visitor — and in dark mode it opened a light menu.
 *
 * The list is portalled and positioned `fixed` for the same reason the date
 * picker is: the form lives inside a panel that can scroll, and a menu in the
 * normal flow gets clipped by it.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className = '',
}: {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  /** Keyboard cursor; starts on the current value so ↑/↓ move from where you are. */
  const [active, setActive] = useState(0)

  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)

  function place() {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Roughly the list's height; enough to decide which side has room.
    const height = options.length * 34 + 8
    const below = window.innerHeight - r.bottom
    setPos({
      top: below < height + 8 && r.top > height ? r.top - height - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
    })
  }

  function openMenu() {
    if (disabled) return
    place()
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function close(focusTrigger = true) {
    setOpen(false)
    if (focusTrigger) btnRef.current?.focus()
  }

  function pick(v: T) {
    onChange(v)
    close()
  }

  // Measure before paint so the list never appears at the wrong spot first.
  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.focus()

    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!listRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    // The panel behind can scroll; the list is positioned against the trigger.
    const reposition = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + options.length) % options.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const o = options[active]
      if (o) pick(o.value)
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openMenu()
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
        className={`border-faint bg-card text-ink flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[16px] transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-[13px] ${open ? 'border-info' : ''} ${className}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown className="text-mid size-[15px] shrink-0" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={onListKey}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 320 }}
            className="border-faint bg-card m-0 list-none rounded-lg border p-1 shadow-lg outline-none"
          >
            {options.map((o, i) => {
              const isSelected = o.value === value
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className="cursor-pointer truncate rounded-md px-2 py-1.5 text-[16px] sm:text-[13px]"
                  style={{
                    // Hover and keyboard share one highlight — two different
                    // "current" rows in one list is confusing.
                    background: i === active ? 'var(--faint2)' : 'transparent',
                    color: isSelected ? 'var(--info)' : 'var(--ink)',
                    fontWeight: isSelected ? 500 : 400,
                  }}
                >
                  {o.label}
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </>
  )
}
