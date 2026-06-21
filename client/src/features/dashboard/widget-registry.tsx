import { BistHeatmapWidget } from '@/features/widgets/BistHeatmapWidget'
import { IdeasTableWidget } from '@/features/widgets/IdeasTableWidget'
import { LayoutGrid, LineChart, ListChecks, Newspaper } from 'lucide-react'
import { MorningNoteWidget } from '@/features/widgets/MorningNoteWidget'
import { TradePlanWidget } from '@/features/widgets/TradePlanWidget'
import { UsHeatmapWidget } from '@/features/widgets/UsHeatmapWidget'
import { WIDGET_TYPES, type WidgetDef, type WidgetType } from './types'

/**
 * Single source of truth for the available widgets. Step 4 fills in the real
 * widget bodies; everything else (canvas, add menu, defaults) reads from here.
 */
export const widgetRegistry: Record<WidgetType, WidgetDef> = {
  'morning-note': {
    type: 'morning-note',
    eyebrow: 'Piyasa Nabzı',
    title: 'Piyasa Nabzı',
    icon: Newspaper,
    defaultSize: { w: 7, h: 9, minW: 4, minH: 6 },
    Component: MorningNoteWidget,
  },
  'ideas-table': {
    type: 'ideas-table',
    eyebrow: 'Alım-Satım Önerileri',
    title: 'Teknik Alım-Satım Önerileri',
    icon: ListChecks,
    defaultSize: { w: 5, h: 9, minW: 4, minH: 6 },
    Component: IdeasTableWidget,
  },
  'trade-plan': {
    type: 'trade-plan',
    eyebrow: 'Trade Planı',
    title: 'Trade Plan Viewer',
    icon: LineChart,
    defaultSize: { w: 7, h: 12, minW: 5, minH: 9 },
    Component: TradePlanWidget,
  },
  'bist-heatmap': {
    type: 'bist-heatmap',
    eyebrow: 'BIST Heatmap',
    title: 'BIST Sektör Heatmap',
    icon: LayoutGrid,
    defaultSize: { w: 5, h: 6, minW: 3, minH: 5 },
    Component: BistHeatmapWidget,
  },
  'us-heatmap': {
    type: 'us-heatmap',
    eyebrow: 'ABD Heatmap',
    title: 'ABD Sektör Heatmap',
    icon: LayoutGrid,
    defaultSize: { w: 5, h: 6, minW: 3, minH: 5 },
    Component: UsHeatmapWidget,
  },
}

/** Stable display/add order. */
export const WIDGET_ORDER: readonly WidgetType[] = WIDGET_TYPES
