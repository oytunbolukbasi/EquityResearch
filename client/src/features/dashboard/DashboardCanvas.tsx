import { bottom, GridLayout, useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout'

import { AddWidgetMenu } from './AddWidgetMenu'
import { widgetRegistry } from './widget-registry'
import { WidgetFrame } from './WidgetFrame'
import type { WidgetInstance, WidgetType } from './types'

const GRID_CONFIG = { cols: 12, rowHeight: 40, margin: [16, 16], containerPadding: [0, 0] } as const

interface DashboardCanvasProps {
  items: WidgetInstance[]
  layout: LayoutItem[]
  onLayoutChange: (layout: Layout) => void
  addWidget: (type: WidgetType) => void
  removeWidget: (id: string) => void
}

export function DashboardCanvas({
  items, layout, onLayoutChange, addWidget, removeWidget,
}: DashboardCanvasProps) {
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

  return (
    <div ref={containerRef}>
      {items.length === 0 ? (
        <EmptyState onAdd={addWidget} />
      ) : (
        mounted && (
          <GridLayout
            width={width}
            layout={gridLayout}
            onLayoutChange={onLayoutChange}
            gridConfig={GRID_CONFIG}
            dragConfig={{ handle: '.widget-drag-handle', cancel: 'button' }}
            resizeConfig={{ handles: ['se'] }}
            onDragStart={() => document.body.classList.add('rgl-interacting')}
            onDragStop={() => document.body.classList.remove('rgl-interacting')}
            onResizeStart={() => document.body.classList.add('rgl-interacting')}
            onResizeStop={() => document.body.classList.remove('rgl-interacting')}
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
