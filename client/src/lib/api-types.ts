import type { Currency } from '@shared/asset-types'

export type MacroBullet = string | { label: string; detail?: string }
export type SectorDeepDive = { title?: string | null; body?: string | null; [key: string]: unknown }
export type IdeaMetrics = Record<string, string | number | null>
export type OhlcPoint = { t: string; o: number; h: number; l: number; c: number }

export interface MorningNote {
  id: number
  date: string
  topCall: string | null
  macroBullets: MacroBullet[] | null
  sectorDeepDive: SectorDeepDive | null
  createdAt: string
}

export interface Idea {
  id: number
  date: string
  ticker: string
  exchange: string | null
  direction: string | null
  thesis: string | null
  metrics: IdeaMetrics | null
  entryLow: number | null
  entryHigh: number | null
  stopLoss: number | null
  target1: number | null
  target2: number | null
  riskRewardH1: number | null
  note: string | null
  riskNote: string | null
  status: string
  createdAt: string
  firstDate: string | null
  endDate: string | null
}

export interface TradePlan {
  id: number
  ticker: string
  exchange: string | null
  currentPrice: number | null
  entryLow: number | null
  entryHigh: number | null
  tp1: number | null
  tp2: number | null
  tp3: number | null
  hardSl: number | null
  thesis: string | null
  invalidation: string | null
  priceHistory: OhlcPoint[] | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface PortfolioPosition {
  id: string
  symbol: string
  name: string | null
  type: string // see shared/asset-types.ts
  quantity: number
  buyPrice: number
  buyDate: string
  currentPrice: number | null
  buyRate: number | null
  /** The currency this position's price and cost are quoted in. */
  currency: Currency
  costBasis: number
  currentValue: number | null
  plAmount: number | null
  plPercent: number | null
  lastUpdated: string | null
}

export interface PortfolioClosedPosition {
  id: string
  symbol: string
  name: string | null
  type: string
  buyPrice: number
  sellPrice: number
  quantity: number
  pl: number
  plPercent: number
  buyDate: string
  sellDate: string
}

export interface PortfolioSummary {
  positions: PortfolioPosition[]
  /** <currency>/TRY, live. TRY is 1. */
  rates: Record<Currency, number>
  /** Currencies whose rate is a static stand-in, not a live quote. */
  ratesFallback: Currency[]
}

export interface PortfolioAction {
  ticker: string
  action: string
  reason: string
}

export interface PortfolioInsight {
  id: number
  date: string
  body: string
  actions: PortfolioAction[] | null
  createdAt: string
}
