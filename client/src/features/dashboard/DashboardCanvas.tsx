import type { CSSProperties } from 'react'
import { bottom, GridLayout, useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout'

import { useMediaQuery } from '@/lib/use-media-query'
import { AddWidgetMenu } from './AddWidgetMenu'
import { widgetRegistry } from './widget-registry'
import { WidgetFrame } from './WidgetFrame'
import type { WidgetInstance, WidgetType } from './types'

const GRID_CONFIG = { cols: 12, rowHeight: 40, margin: [16, 16], containerPadding: [4, 0] } as const

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
  const isMobile = useMediaQuery('(max-width: 768px)')

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

  // rowHeight(40) + vertical margin(16) = 56px per grid unit — dots align with snap rows
  // min-height fills viewport so empty space below widgets is also draggable
  const canvasBg: CSSProperties = {
    backgroundImage: 'radial-gradient(circle, var(--faint) 1px, transparent 1px)',
    backgroundSize: '56px 56px',
    minHeight: 'calc(100vh - 49px)',
  }

  // Mobile stack order follows the desktop layout's visual top-to-bottom (y, then x).
  const stackedItems = isMobile
    ? [...items].sort((a, b) => {
        const la = byId.get(a.i)
        const lb = byId.get(b.i)
        if (!la || !lb) return 0
        return la.y - lb.y || la.x - lb.x
      })
    : items

  return (
    <div ref={containerRef} style={canvasBg}>
      {items.length === 0 ? (
        <EmptyState onAdd={addWidget} />
      ) : isMobile ? (
        // Below 768px: bypass the grid entirely and stack widgets in one column.
        // No drag/resize, no onLayoutChange → the persisted layout is untouched;
        // widening the window re-mounts GridLayout with the same stored layout.
        <div className="flex flex-col gap-4 p-4">
          {stackedItems.map((item) => {
            const def = widgetRegistry[item.type]
            const Widget = def.Component
            return (
              <div key={item.i} className="h-[70vh]">
                <WidgetFrame eyebrow={def.eyebrow} onRemove={() => removeWidget(item.i)} showHandle={false}>
                  <Widget />
                </WidgetFrame>
              </div>
            )
          })}
        </div>
      ) : (
        mounted && (
          <GridLayout
            width={width}
            layout={gridLayout}
            onLayoutChange={onLayoutChange}
            gridConfig={GRID_CONFIG}
            dragConfig={{ handle: '.widget-drag-handle', cancel: 'button' }}
            resizeConfig={{ handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] }}
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
