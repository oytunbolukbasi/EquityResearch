export type MacroBullet = string | { label: string; detail?: string }
export type SectorDeepDive = { title?: string | null; body?: string | null; [key: string]: unknown }
export type IdeaMetrics = Record<string, string | number | null>
export type OhlcPoint = { t: string; o: number; h: number; l: number; c: number }
export type HeatmapSector = { name: string; change_pct: number; note?: string | null }

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
  createdAt: string
  updatedAt: string
}

export interface Heatmap {
  id: number
  date: string
  market: string
  sectors: HeatmapSector[] | null
  createdAt: string
}
