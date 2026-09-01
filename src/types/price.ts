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

// ---------------------------------------------------------------------------
// Move attribution types
// ---------------------------------------------------------------------------

/**
 * Price delta for a single oracle source on one WS tick.
 * `prevPrice` is `null` on the very first tick seen for that source.
 */
export interface SourceDelta {
  /** The oracle source identifier (e.g. "chainlink"). */
  source: string
  /** Source price on this tick (derived from the per-source field when present, otherwise the aggregate). */
  price: number
  /** Source price on the previous tick, or `null` if this is the first observed tick. */
  prevPrice: number | null
  /** Absolute price change (price − prevPrice), or `null` on the first tick. */
  delta: number | null
  /** Percentage change, or `null` when prevPrice is null or zero. */
  deltaPercent: number | null
}

/**
 * Attribution record for a single WS price update tick.
 *
 * Bounded to {@link ATTRIBUTION_RING_BUFFER_SIZE} entries per asset pair inside
 * PriceContext — older entries are evicted when the buffer is full, so memory
 * footprint is O(pairs × ATTRIBUTION_RING_BUFFER_SIZE).
 */
export interface MoveAttribution {
  /** Asset pair this attribution record belongs to. */
  assetPair: string
  /** Unix timestamp (ms) of this tick. */
  timestamp: number
  /** Aggregate price for this tick. */
  price: number
  /** Aggregate delta vs previous tick, or `null` on the first tick. */
  delta: number | null
  /** Aggregate delta as a percentage, or `null` when prevPrice is null or zero. */
  deltaPercent: number | null
  /** Per-source breakdown for this tick. */
  sources: SourceDelta[]
  /** The source(s) with the largest absolute delta — the "leader(s)" of this move. */
  leadingSources: string[]
}

/**
 * Maximum number of attribution records retained per asset pair in PriceContext.
 * At 50 entries × up to 4 pairs = 200 records in the worst case, well within
 * acceptable memory bounds (each record is ~300 bytes).
 */
export const ATTRIBUTION_RING_BUFFER_SIZE = 50

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

/** WebSocket handshake message sent by the client on connect (#472). */
export interface WsHelloMessage {
  type: 'hello'
  /** The WS protocol version this client supports (see `api/version.ts`). */
  protocolVersion: number
}

/** WebSocket handshake response from the server confirming the protocol version (#472). */
export interface WsWelcomeMessage {
  type: 'welcome'
  /** The WS protocol version the server will serve. */
  protocolVersion: number
}

/** WebSocket unsubscribe message sent by the client. */
export interface WsUnsubscribeMessage {
  action: 'unsubscribe'
  /** Asset pairs to unsubscribe from. */
  assetPairs: string[]
}

/** Client request to pause inbound price updates under backpressure (#469). */
export interface WsPauseMessage {
  action: 'pause'
}

/** Client request to resume inbound price updates once backpressure clears (#469). */
export interface WsResumeMessage {
  action: 'resume'
}

/** Server ack confirming inbound updates have been paused for this connection (#469). */
export interface WsPausedMessage {
  type: 'paused'
}

/** Server ack confirming inbound updates have resumed for this connection (#469). */
export interface WsResumedMessage {
  type: 'resumed'
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
  /**
   * Optional per-source prices provided by the server.
   * When present, each key is a source name and the value is that source's
   * individual price. When absent, all sources are assumed to report the
   * same aggregate price (used for attribution delta computation).
   */
  sourcePrices?: Record<string, number>
}

/** Union of all possible WebSocket message types. */
export type WsMessage = WsPriceUpdate | WsWelcomeMessage | WsPausedMessage | WsResumedMessage

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
