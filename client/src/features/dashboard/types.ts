import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Available widget types. Order here is the order shown in the "add" menu. */
export const WIDGET_TYPES = [
  'morning-note',
  'ideas-table',
  'trade-plan',
  'portfolio',
] as const

export type WidgetType = (typeof WIDGET_TYPES)[number]

export interface WidgetInstance {
  /** Unique instance id — also used as the react-grid-layout item key. */
  i: string
  type: WidgetType
}

export interface WidgetDef {
  type: WidgetType
  /** Short uppercase mono label shown in the widget header. */
  eyebrow: string
  /** Human title shown in the "add widget" menu. */
  title: string
  icon: LucideIcon
  /** Default footprint on the 12-col grid (rowHeight 40px). */
  defaultSize: { w: number; h: number; minW: number; minH: number }
  Component: ComponentType
}
