import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WIDGET_ORDER, widgetRegistry } from './widget-registry'
import type { WidgetType } from './types'

export function AddWidgetMenu({
  onAdd, triggerClassName,
}: {
  onAdd: (type: WidgetType) => void
  triggerClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={cn('gap-1.5', triggerClassName)}>
          <Plus className="size-4" />
          Widget Ekle
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 widget-add-panel">
        {WIDGET_ORDER.map((type) => {
          const def = widgetRegistry[type]
          const Icon = def.icon
          return (
            <DropdownMenuItem key={type} onSelect={() => onAdd(type)} className="gap-2.5">
              <Icon className="size-4" />
              {def.title}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
