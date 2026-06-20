import { Plus } from 'lucide-react'

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

export function AddWidgetMenu({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-4" />
          Widget Ekle
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="num text-mid text-[11px] tracking-[0.12em] uppercase">
          Widget Ekle
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
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
