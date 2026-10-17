/**
 * Classifies what price data the dashboard can show while the network is
 * degraded (#827).
 *
 * - `live`: fresh prices from the network are on screen.
 * - `stale`: no live prices, but a persisted snapshot exists and can be shown
 *   with a "snapshot age" badge.
 * - `unavailable`: no live prices and no usable snapshot (never cached, or the
 *   snapshot expired). Nothing can be rendered, so the UI must say so explicitly
 *   instead of falling back to a blank grid.
 */
export type OfflineDataState = 'live' | 'stale' | 'unavailable'

export interface OfflineDataInput {
  hasLivePrices: boolean
  hasSnapshot: boolean
}

export function resolveOfflineDataState({ hasLivePrices, hasSnapshot }: OfflineDataInput): OfflineDataState {
  if (hasLivePrices) return 'live'
  if (hasSnapshot) return 'stale'
  return 'unavailable'
}
