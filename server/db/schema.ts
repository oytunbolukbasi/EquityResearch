import {
  date,
  doublePrecision,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Schema mirrors the project brief. Kept jsonb-heavy on purpose so sector- or
 * market-specific fields can vary without migrations. Price fields use double
 * precision so they serialize as plain JSON numbers for the widgets.
 */

export type MacroBullet = string | { label: string; detail?: string }
export type SectorDeepDive = { title?: string; body?: string } | Record<string, unknown>
export type IdeaMetrics = Record<string, string | number | null>
export type OhlcPoint = { t: string; o: number; h: number; l: number; c: number }
export type HeatmapSector = { name: string; change_pct: number; note?: string | null }

export const morningNotes = pgTable('morning_notes', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  topCall: text('top_call'),
  macroBullets: jsonb('macro_bullets').$type<MacroBullet[]>(),
  sectorDeepDive: jsonb('sector_deep_dive').$type<SectorDeepDive>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const ideas = pgTable('ideas', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  ticker: text('ticker').notNull(),
  exchange: text('exchange'),
  direction: text('direction'), // long | short
  thesis: text('thesis'),
  // F/K, PD/DD, ROE, dividend yield, etc. — sector-variable fields.
  metrics: jsonb('metrics').$type<IdeaMetrics>(),
  entryLow: doublePrecision('entry_low'),
  entryHigh: doublePrecision('entry_high'),
  stopLoss: doublePrecision('stop_loss'),
  target1: doublePrecision('target_1'),
  target2: doublePrecision('target_2'),
  riskRewardH1: doublePrecision('risk_reward_h1'),
  note: text('note'),
  riskNote: text('risk_note'),
  status: text('status').default('active').notNull(), // active | hit_target | stopped | watch
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tradePlans = pgTable('trade_plans', {
  id: serial('id').primaryKey(),
  ticker: text('ticker').notNull(),
  exchange: text('exchange'),
  currentPrice: doublePrecision('current_price'),
  entryLow: doublePrecision('entry_low'),
  entryHigh: doublePrecision('entry_high'),
  tp1: doublePrecision('tp1'),
  tp2: doublePrecision('tp2'),
  tp3: doublePrecision('tp3'),
  hardSl: doublePrecision('hard_sl'),
  thesis: text('thesis'),
  invalidation: text('invalidation'),
  // OHLC array for the sparkline/candles drawn at publish time.
  priceHistory: jsonb('price_history').$type<OhlcPoint[]>(),
  status: text('status').default('active').notNull(), // active | stopped
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const heatmaps = pgTable('heatmaps', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  market: text('market').notNull(), // 'BIST' | 'US'
  sectors: jsonb('sectors').$type<HeatmapSector[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type MorningNote = typeof morningNotes.$inferSelect
export type Idea = typeof ideas.$inferSelect
export type TradePlan = typeof tradePlans.$inferSelect
export type Heatmap = typeof heatmaps.$inferSelect
