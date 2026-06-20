import { bottom, GridLayout, useContainerWidth, type LayoutItem } from 'react-grid-layout'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AddWidgetMenu } from './AddWidgetMenu'
import { useDashboardLayout } from './useDashboardLayout'
import { widgetRegistry } from './widget-registry'
import { WidgetFrame } from './WidgetFrame'
import type { WidgetType } from './types'

const GRID_CONFIG = { cols: 12, rowHeight: 40, margin: [16, 16], containerPadding: [0, 0] } as const

export function DashboardCanvas() {
  const { items, layout, addWidget, removeWidget, onLayoutChange, resetLayout } =
    useDashboardLayout()
  const { width, containerRef, mounted } = useContainerWidth()

  // Reconcile: guarantee a layout entry for every item, even if localStorage
  // has drifted (e.g. an item with no stored position). New items stack below.
  const byId = new Map(layout.map((l) => [l.i, l]))
  let nextY = bottom(layout)
  const gridLayout: LayoutItem[] = items.map((item) => {
    const existing = byId.get(item.i)
    if (existing) return existing
    const d = widgetRegistry[item.type].defaultSize
    const li: LayoutItem = { i: item.i, x: 0, y: nextY, w: d.w, h: d.h, minW: d.minW, minH: d.minH }
    nextY += d.h
    return li
  })

  const handleAdd = (type: WidgetType) => addWidget(type)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-mid text-sm">
          Widget'ları başlığından sürükle, sağ-alt köşeden boyutlandır. Düzen otomatik kaydedilir.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={resetLayout}
            className="text-mid gap-1.5"
            title="Varsayılan düzene dön"
          >
            <RotateCcw className="size-4" />
            Düzeni Sıfırla
          </Button>
          <AddWidgetMenu onAdd={handleAdd} />
        </div>
      </div>

      <div ref={containerRef}>
        {items.length === 0 ? (
          <EmptyState onAdd={handleAdd} />
        ) : (
          mounted && (
            <GridLayout
              width={width}
              layout={gridLayout}
              onLayoutChange={onLayoutChange}
              gridConfig={GRID_CONFIG}
              dragConfig={{ handle: '.widget-drag-handle', cancel: 'button' }}
              resizeConfig={{ handles: ['se'] }}
            >
              {items.map((item) => {
                const def = widgetRegistry[item.type]
                const Widget = def.Component
                return (
                  <div key={item.i}>
                    <WidgetFrame eyebrow={def.eyebrow} onRemove={() => removeWidget(item.i)}>
                      <Widget />
                    </WidgetFrame>
                  </div>
                )
              })}
            </GridLayout>
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  return (
    <div className="border-faint flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
      <p className="text-mid text-sm">Panel boş. Bir widget ekleyerek başla.</p>
      <AddWidgetMenu onAdd={onAdd} />
    </div>
  )
}
