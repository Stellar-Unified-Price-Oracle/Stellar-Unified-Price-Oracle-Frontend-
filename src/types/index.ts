export interface PriceData {
  assetPair: string
  price: number
  timestamp: number
  confidence: number
  sources: string[]
}

export type PriceSyncState = 'optimistic' | 'confirmed' | 'rollback' | 'synced'

export interface LivePriceEntry {
  data: PriceData
  syncState: PriceSyncState
  flashVersion: number
}

export interface PriceHistoryEntry {
  price: number
  timestamp: number
  confidence: number
  sources: string[]
}

export interface PriceHistoryResponse {
  pair: string
  history: PriceHistoryEntry[]
}

export type SourceName = 'chainlink' | 'redstone' | 'band' | 'reflector'

export interface SourceHealth {
  source: SourceName
  status: 'healthy' | 'degraded' | 'down'
  lastUpdate: number | null
  latency: number | null
}

export interface WsSubscribeMessage {
  action: 'subscribe'
  assetPairs: string[]
}

export interface WsUnsubscribeMessage {
  action: 'unsubscribe'
  assetPairs: string[]
}

export interface WsPriceUpdate {
  type: 'price_update'
  assetPair: string
  price: number
  timestamp: number
  confidence: number
  sources: string[]
}

export type WsMessage = WsPriceUpdate

export interface Alert {
  id: string
  assetPair: string
  upperThreshold: number | null
  lowerThreshold: number | null
  /** Divergence alert: fire when max pairwise deviation between sources exceeds this % (0–100). null = disabled */
  divergenceThreshold: number | null
  triggerOnce: boolean
  active: boolean
  createdAt: number
  lastTriggeredAt: number | null
}

export interface AlertFormData {
  assetPair: string
  upperThreshold: string
  lowerThreshold: string
  /** String representation of divergenceThreshold; empty string = not set */
  divergenceThreshold: string
  triggerOnce: boolean
}

export interface AlertsContextType {
  alerts: Alert[]
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'>) => Alert
  updateAlert: (id: string, updates: Partial<Omit<Alert, 'id' | 'createdAt'>>) => void
  removeAlert: (id: string) => void
  getAlertsForPair: (assetPair: string) => Alert[]
  hasAlertsForPair: (assetPair: string) => boolean
  activeCount: number
  isPanelOpen: boolean
  togglePanel: () => void
  markAsRead: (id: string) => void
}

// ---------------------------------------------------------------------------
// #458 — Source Divergence
// ---------------------------------------------------------------------------

/**
 * Per-source price contribution used to compute inter-oracle divergence.
 * Keys are SourceName values; values are the price reported by that source.
 */
export type SourcePriceMap = Partial<Record<SourceName, number>>

/**
 * Result of computeDivergence for a given asset pair.
 */
export interface DivergenceResult {
  /** Maximum pairwise percentage deviation between any two contributing sources (0–100). */
  maxDeviationPct: number
  /** The two sources with the widest spread (may be undefined if fewer than 2 sources). */
  highSource: SourceName | null
  lowSource: SourceName | null
  /** Number of contributing sources evaluated. */
  sourceCount: number
}

// ---------------------------------------------------------------------------
// #457 — Developer Portal / API Key Management
// ---------------------------------------------------------------------------

export type ApiKeyStatus = 'active' | 'revoked'

export interface ApiKey {
  id: string
  name: string
  /** Plaintext value — shown ONCE at creation, then cleared from state and never stored. */
  plaintextValue: string | null
  /** Masked preview, e.g. "sk_••••••••••••ABCD" */
  maskedValue: string
  status: ApiKeyStatus
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
}

export interface ApiKeyUsageStats {
  keyId: string
  requestsToday: number
  requestsThisMonth: number
  webhookDeliveriesToday: number
  rateLimitRemaining: number
  rateLimitTotal: number
}

export interface DevSession {
  /** Opaque session token — stored in memory only, never in localStorage. */
  token: string
  email: string
  displayName: string
  /** Unix ms timestamp of session expiry. */
  expiresAt: number
}

export interface ApiKeysContextType {
  session: DevSession | null
  keys: ApiKey[]
  usageStats: Map<string, ApiKeyUsageStats>
  isLoading: boolean
  error: string | null
  /** Simulates magic-link sign-in; sets an in-memory session. */
  signIn: (email: string) => Promise<void>
  signOut: () => void
  createKey: (name: string) => Promise<ApiKey>
  revokeKey: (id: string) => Promise<void>
  renameKey: (id: string, newName: string) => Promise<void>
  /** Dismiss the one-time plaintext value for a key after the user copies it. */
  acknowledgeKeyValue: (id: string) => void
}
