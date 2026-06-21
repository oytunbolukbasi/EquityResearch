import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AddWidgetMenu } from './AddWidgetMenu'
import type { WidgetType } from './types'

export function DashboardWidgetControls({
  onAdd, onReset,
}: {
  onAdd: (type: WidgetType) => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center">
      <AddWidgetMenu onAdd={onAdd} triggerClassName="rounded-r-none border-r-0" />
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        title="Düzeni Sıfırla"
        aria-label="Düzeni Sıfırla"
        className="text-mid h-8 w-9 rounded-l-none border-l-0 p-0"
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  )
}
