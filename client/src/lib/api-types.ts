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
  type: string // 'stock' | 'us_stock' | 'fund'
  quantity: number
  buyPrice: number
  buyDate: string
  currentPrice: number | null
  buyRate: number | null
  costBasis: number
  currentValue: number | null
  plAmount: number | null
  plPercent: number | null
  costBasisTRY: number | null
  currentValueTRY: number | null
}

export interface PortfolioClosedPosition {
  symbol: string
  buyPrice: number
  sellPrice: number
  quantity: number
  pl: number
  plPercent: number
  sellDate: string
}

export interface PortfolioSnapshot {
  date: string
  totalValue: number
  totalCost: number
  unrealizedProfit: number
  realizedProfit: number
}

export interface PortfolioSummary {
  positions: PortfolioPosition[]
  snapshots: PortfolioSnapshot[]
  usdTryRate: number
  usdTryRateIsFallback: boolean
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
