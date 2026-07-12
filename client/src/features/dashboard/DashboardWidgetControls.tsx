import { Moon, RotateCcw, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'
import { AddWidgetMenu } from './AddWidgetMenu'
import type { WidgetType } from './types'

export function DashboardWidgetControls({
  onAdd, onReset,
}: {
  onAdd: (type: WidgetType) => void
  onReset: () => void
}) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="flex items-center gap-2">
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
      <Button
        variant="outline"
        size="sm"
        onClick={toggle}
        title={isDark ? 'Açık tema' : 'Koyu tema'}
        aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
        className="text-mid h-8 w-9 p-0"
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  )
}
