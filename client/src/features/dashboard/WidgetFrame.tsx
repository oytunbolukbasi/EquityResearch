import { motion } from 'framer-motion'
import { GripVertical, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface WidgetFrameProps {
  eyebrow: string
  onRemove: () => void
  children: React.ReactNode
  // Off in the mobile stacked view: no grid → no drag, so hide the grip
  // (and its drag-handle styling) which would otherwise imply draggability.
  showHandle?: boolean
}

export function WidgetFrame({ eyebrow, onRemove, children, showHandle = true }: WidgetFrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="bg-card flex h-full flex-col overflow-hidden rounded-lg border"
    >
      <header
        className={`flex items-center gap-2 border-b px-4 py-2.5 select-none ${
          showHandle ? 'widget-drag-handle cursor-move' : ''
        }`}
      >
        {showHandle && <GripVertical className="text-faint size-4 shrink-0" />}
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="widget-eyebrow text-ink">
            {eyebrow}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Widget'ı kaldır"
          onClick={onRemove}
          className="text-mid hover:text-down ml-2 size-7 shrink-0"
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </motion.div>
  )
}
