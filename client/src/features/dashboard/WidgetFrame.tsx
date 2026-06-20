import { useState } from 'react'
import { motion } from 'framer-motion'
import { GripVertical, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { WidgetSubtitleCtx } from './widget-subtitle'

interface WidgetFrameProps {
  eyebrow: string
  onRemove: () => void
  children: React.ReactNode
}

export function WidgetFrame({ eyebrow, onRemove, children }: WidgetFrameProps) {
  const [subtitle, setSubtitle] = useState('')

  return (
    <WidgetSubtitleCtx.Provider value={setSubtitle}>
      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="bg-card flex h-full flex-col overflow-hidden rounded-lg border"
      >
        <header className="widget-drag-handle flex cursor-move items-center gap-2 border-b px-4 py-2.5 select-none">
          <GripVertical className="text-faint size-4 shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="num text-mid text-[11px] tracking-[0.12em] uppercase">
              {eyebrow}
            </span>
            {subtitle && (
              <span className="num ml-2 text-[11px] text-mid opacity-55 normal-case tracking-normal">
                · {subtitle}
              </span>
            )}
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
    </WidgetSubtitleCtx.Provider>
  )
}
