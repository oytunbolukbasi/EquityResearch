import { useCallback, useEffect, useState } from 'react'
import { bottom, type Layout, type LayoutItem } from 'react-grid-layout'
import { widgetRegistry } from './widget-registry'
import type { WidgetInstance, WidgetType } from './types'

// Versioned keys so the persisted layout can be migrated later if needed.
const ITEMS_KEY = 'dashboard:v1:items'
const LAYOUT_KEY = 'dashboard:v1:layout'

export const DEFAULT_ITEMS: WidgetInstance[] = [
  { i: 'morning-note', type: 'morning-note' },
  { i: 'ideas-table', type: 'ideas-table' },
  { i: 'trade-plan', type: 'trade-plan' },
  { i: 'bist-heatmap', type: 'bist-heatmap' },
  { i: 'us-heatmap', type: 'us-heatmap' },
  { i: 'portfolio', type: 'portfolio' },
]

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'morning-note', x: 0, y: 0, w: 7, h: 9, minW: 4, minH: 6 },
  { i: 'ideas-table', x: 7, y: 0, w: 5, h: 9, minW: 4, minH: 6 },
  { i: 'trade-plan', x: 0, y: 9, w: 7, h: 12, minW: 5, minH: 9 },
  { i: 'bist-heatmap', x: 7, y: 9, w: 5, h: 6, minW: 3, minH: 5 },
  { i: 'us-heatmap', x: 7, y: 15, w: 5, h: 6, minW: 3, minH: 5 },
  { i: 'portfolio', x: 0, y: 21, w: 7, h: 12, minW: 5, minH: 8 },
]

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function useDashboardLayout() {
  const [items, setItems] = useState<WidgetInstance[]>(() => load(ITEMS_KEY, DEFAULT_ITEMS))
  const [layout, setLayout] = useState<LayoutItem[]>(() => load(LAYOUT_KEY, DEFAULT_LAYOUT))

  useEffect(() => {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  }, [layout])

  const addWidget = useCallback((type: WidgetType) => {
    const def = widgetRegistry[type]
    const id = `${type}-${Date.now().toString(36)}`
    setItems((prev) => [...prev, { i: id, type }])
    setLayout((prev) => [
      ...prev,
      {
        i: id,
        x: 0,
        y: bottom(prev), // drop new widget at the bottom of the stack
        w: def.defaultSize.w,
        h: def.defaultSize.h,
        minW: def.defaultSize.minW,
        minH: def.defaultSize.minH,
      },
    ])
  }, [])

  const removeWidget = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.i !== id))
    setLayout((prev) => prev.filter((l) => l.i !== id))
  }, [])

  const onLayoutChange = useCallback((next: Layout) => {
    setLayout(next.map((l) => ({ ...l })))
  }, [])

  const resetLayout = useCallback(() => {
    setItems(DEFAULT_ITEMS)
    setLayout(DEFAULT_LAYOUT)
  }, [])

  return { items, layout, addWidget, removeWidget, onLayoutChange, resetLayout }
}
