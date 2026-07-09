import { IdeasTableWidget } from '@/features/widgets/IdeasTableWidget'
import { LineChart, ListChecks, Newspaper, TrendingUp, Wallet } from 'lucide-react'
import { MorningNoteWidget } from '@/features/widgets/MorningNoteWidget'
import { PaperTradingWidget } from '@/features/widgets/PaperTradingWidget'
import { PortfolioWidget } from '@/features/widgets/PortfolioWidget'
import { TradePlanWidget } from '@/features/widgets/TradePlanWidget'
import { WIDGET_TYPES, type WidgetDef, type WidgetType } from './types'

/**
 * Single source of truth for the available widgets. Everything else (canvas,
 * add menu, defaults) reads from here.
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
    eyebrow: 'Pozisyon Fikirleri',
    title: 'Pozisyon Fikirleri',
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
  'portfolio': {
    type: 'portfolio',
    eyebrow: 'Portföy Durumu',
    title: 'Portföy Durumu',
    icon: Wallet,
    defaultSize: { w: 7, h: 12, minW: 5, minH: 8 },
    Component: PortfolioWidget,
  },
  'paper-trading': {
    type: 'paper-trading',
    eyebrow: 'PAPER TRADING',
    title: 'Paper Trading',
    icon: TrendingUp,
    defaultSize: { w: 12, h: 14, minW: 8, minH: 10 },
    Component: PaperTradingWidget,
  },
}

/** Stable display/add order. */
export const WIDGET_ORDER: readonly WidgetType[] = WIDGET_TYPES
