import { motion } from 'framer-motion'
import { GripVertical, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface WidgetFrameProps {
  eyebrow: string
  onRemove: () => void
  children: React.ReactNode
}

/**
 * Card chrome for a single canvas widget. The header is the drag handle
 * (`.widget-drag-handle`, wired in DashboardCanvas); the body scrolls.
 * Subtle Framer enter only — grid movement transitions are handled by
 * react-grid-layout's own CSS, so we never animate transform here.
 */
export function WidgetFrame({ eyebrow, onRemove, children }: WidgetFrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="bg-card flex h-full flex-col overflow-hidden rounded-lg border"
    >
      <header className="widget-drag-handle flex cursor-move items-center gap-2 border-b px-4 py-2.5 select-none">
        <GripVertical className="text-faint size-4 shrink-0" />
        <span className="num text-mid truncate text-[11px] tracking-[0.12em] uppercase">
          {eyebrow}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Widget'ı kaldır"
          onClick={onRemove}
          className="text-mid hover:text-down ml-auto size-7"
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </motion.div>
  )
}
