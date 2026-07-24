/**
 * Price-related types for the Stellar Unified Price Oracle.
 *
 * All fields on {@link PriceData} are required and must be present in API
 * responses. The Zod schema in `src/api/schemas.ts` validates this at runtime
 * (always in dev/test, sampled in production).
 */

/** Aggregated price snapshot for a single asset pair from all oracle sources. */
export interface PriceData {
  /** The asset pair (e.g. "BTC/USD", "XLM/USD"). */
  assetPair: string
  /** The aggregated price in the quote currency. */
  price: number
  /** Unix timestamp in milliseconds when the price was last updated. */
  timestamp: number
  /** Confidence score from 0.0 (none) to 1.0 (certain). */
  confidence: number
  /** List of oracle sources that contributed to this price. */
  sources: string[]
}

/** Synchronisation state for a live price entry received via WebSocket. */
export type PriceSyncState = 'optimistic' | 'confirmed' | 'rollback' | 'synced'

/** A price entry enriched with its WebSocket synchronisation metadata. */
export interface LivePriceEntry {
  /** The price data. */
  data: PriceData
  /** Current sync state relative to the REST canonical source. */
  syncState: PriceSyncState
  /** Monotonically incrementing version used for flash animations. */
  flashVersion: number
}

/** A single historical price data point. */
export interface PriceHistoryEntry {
  /** Price at this point in time. */
  price: number
  /** Unix timestamp in milliseconds. */
  timestamp: number
  /** Confidence score from 0.0 to 1.0. */
  confidence: number
  /** Oracle sources active at this point in time. */
  sources: string[]
}

/** Paginated price history response for a single asset pair. */
export interface PriceHistoryResponse {
  /** The asset pair this history belongs to. */
  pair: string
  /** Ordered list of historical price entries (oldest first). */
  history: PriceHistoryEntry[]
}

/** Known oracle source identifiers. */
export type SourceName = 'chainlink' | 'redstone' | 'band' | 'reflector'

/** Health status for a single oracle source. */
export interface SourceHealth {
  /** The oracle source identifier. */
  source: SourceName
  /** Current health status. */
  status: 'healthy' | 'degraded' | 'down'
  /** Unix timestamp in milliseconds of the last successful update, or null if never. */
  lastUpdate: number | null
  /** Latest measured latency in milliseconds, or null if not available. */
  latency: number | null
}

/** WebSocket subscribe message sent by the client. */
export interface WsSubscribeMessage {
  action: 'subscribe'
  /** Asset pairs to subscribe to. */
  assetPairs: string[]
}

/** WebSocket unsubscribe message sent by the client. */
export interface WsUnsubscribeMessage {
  action: 'unsubscribe'
  /** Asset pairs to unsubscribe from. */
  assetPairs: string[]
}

/** A real-time price update received via WebSocket. */
export interface WsPriceUpdate {
  type: 'price_update'
  /** The asset pair that was updated. */
  assetPair: string
  /** The new price. */
  price: number
  /** Unix timestamp in milliseconds. */
  timestamp: number
  /** Confidence score from 0.0 to 1.0. */
  confidence: number
  /** Oracle sources that contributed to this update. */
  sources: string[]
}

/** Union of all possible WebSocket message types. */
export type WsMessage = WsPriceUpdate

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Type guard that verifies an unknown value conforms to the {@link PriceData}
 * shape at runtime. All fields are checked to prevent implicit undefined access.
 */
export function isPriceData(value: unknown): value is PriceData {
  if (value == null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.assetPair === 'string' &&
    typeof obj.price === 'number' &&
    !Number.isNaN(obj.price) &&
    typeof obj.timestamp === 'number' &&
    !Number.isNaN(obj.timestamp) &&
    typeof obj.confidence === 'number' &&
    !Number.isNaN(obj.confidence) &&
    Array.isArray(obj.sources) &&
    obj.sources.every((s: unknown) => typeof s === 'string')
  )
}
