/**
 * Static, illustrative quotes shown in empty states so a new user can see what
 * the dashboard looks like before any feed is live (#817). These values are
 * hand-written placeholders, never fetched, cached, or derived from upstream
 * oracles, so they must not be presented as market data.
 */
export interface SampleQuote {
  assetPair: string
  /** Illustrative price in USD. */
  price: number
}

export const SAMPLE_DATA_LABEL = 'Sample data: illustrative values, not live market prices'

export const SAMPLE_QUOTES: readonly SampleQuote[] = [
  { assetPair: 'XLM/USD', price: 0.12 },
  { assetPair: 'BTC/USD', price: 65000 },
  { assetPair: 'ETH/USD', price: 3200 },
]

/** Formats a sample price with a fixed two-decimal style, independent of the live locale settings. */
export function formatSamplePrice(price: number): string {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}
