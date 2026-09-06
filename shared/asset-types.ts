/**
 * What an asset type IS — the one place the client and the server agree.
 *
 * Shared rather than mirrored on purpose: which currency a type is priced in
 * decides how its value is converted to lira. The client and the server both
 * need that answer, and two copies drifting apart would not throw — it would
 * quietly report the wrong money.
 */

export const POSITION_TYPES = ['stock', 'us_stock', 'de_stock', 'fund', 'crypto'] as const
export type PositionType = (typeof POSITION_TYPES)[number]

export type Currency = 'TRY' | 'USD' | 'EUR'

/** The currency a position's price and cost are quoted in. */
export const CURRENCY_FOR_TYPE: Record<PositionType, Currency> = {
  stock: 'TRY',
  fund: 'TRY',
  us_stock: 'USD',
  de_stock: 'EUR',
  // Crypto is quoted in USD; the panel converts like any other USD holding.
  crypto: 'USD',
}

export const UNIT_FOR_CURRENCY: Record<Currency, '₺' | '$' | '€'> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
}

/**
 * Where the price comes from. Three sources, three rhythms — see the price
 * pipeline section in CLAUDE.md.
 *
 * German shares ride the existing Google Sheet: the sheet is a list of
 * GOOGLEFINANCE cells and does not care which exchange a ticker trades on.
 */
export const PRICE_SOURCE_FOR_TYPE: Record<PositionType, 'sheet' | 'fund' | 'crypto'> = {
  stock: 'sheet',
  us_stock: 'sheet',
  de_stock: 'sheet',
  fund: 'fund',
  crypto: 'crypto',
}

/** Full label — forms, legends, section headings. */
export const TYPE_LABEL: Record<PositionType, string> = {
  stock: 'BİST hissesi',
  us_stock: 'ABD hissesi',
  de_stock: 'Almanya hissesi',
  fund: 'Yatırım fonu',
  crypto: 'Kripto',
}

/** Short label for dense places — table sub-rows, cards. */
export const TYPE_SHORT: Record<PositionType, string> = {
  stock: 'BİST',
  us_stock: 'ABD',
  de_stock: 'Almanya',
  fund: 'Fon',
  crypto: 'Kripto',
}

/**
 * How the five types are grouped wherever they are shown together: the
 * allocation bar, its legend, and the portfolio sections.
 *
 * BİST and funds share a group because they are the same money in the same
 * currency, and because a fifth colour does not exist: measured against the
 * dataviz validator, no set of five hues clears the separation floor once
 * green and red are off the table (they mean profit and loss here). Four does.
 *
 * Order is fixed and does not follow size — a group must be findable in the
 * same place every time.
 */
export const ASSET_GROUPS = [
  { id: 'tr', label: 'Borsa İstanbul ve Fon', types: ['stock', 'fund'] },
  { id: 'us', label: 'ABD hisseleri', types: ['us_stock'] },
  { id: 'de', label: 'Almanya hisseleri', types: ['de_stock'] },
  { id: 'crypto', label: 'Kripto', types: ['crypto'] },
] as const satisfies readonly { id: string; label: string; types: readonly PositionType[] }[]

export type AssetGroupId = (typeof ASSET_GROUPS)[number]['id']

export function groupOf(type: string): AssetGroupId {
  for (const g of ASSET_GROUPS) {
    if ((g.types as readonly string[]).includes(type)) return g.id
  }
  return 'tr'
}

/**
 * The exchange GOOGLEFINANCE has to be told about.
 *
 * SAP forced this: it trades in Frankfurt AND in the US, and a bare "SAP" in a
 * GOOGLEFINANCE cell resolves to the US listing — so a German position quietly
 * showed an American price. Qualifying the ticker fixes the cell.
 *
 * The panel stores the BARE ticker either way and adds the prefix only when
 * talking to the sheet, because the sheet answers keyed by the bare ticker.
 * (One consequence worth knowing: the sheet can hold one row per ticker, so
 * holding SAP in both Frankfurt and New York at once is not representable.)
 */
export const EXCHANGE_FOR_TYPE: Partial<Record<PositionType, string>> = {
  de_stock: 'FRA',
}

/** "SAP" from "FRA:SAP"; anything already bare is returned unchanged. */
export function bareSymbol(symbol: string): string {
  return symbol.replace(/^[A-Za-z]+:/, '').trim()
}

/** What the sheet's GOOGLEFINANCE cell should say: "FRA:SAP", "AKBNK". */
export function sheetSymbol(symbol: string, type: string): string {
  const bare = bareSymbol(symbol).toUpperCase()
  const exchange = EXCHANGE_FOR_TYPE[type as PositionType]
  return exchange ? `${exchange}:${bare}` : bare
}
