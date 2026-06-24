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
  triggerOnce: boolean
  active: boolean
  createdAt: number
  lastTriggeredAt: number | null
}

export interface AlertFormData {
  assetPair: string
  upperThreshold: string
  lowerThreshold: string
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

// Rate Limit Types (Issue #93)
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number // Unix timestamp in seconds
}

// API Key Types (Issue #92)
export type ApiKeyPermission = 'read' | 'write' | 'admin'

export interface ApiKey {
  id: string
  name: string
  key: string // Only returned when first created
  maskedKey: string // e.g., "sk_test_...xxxx"
  permissions: ApiKeyPermission[]
  createdAt: number
  lastUsedAt: number | null
  quotaLimit: number
  quotaUsed: number
  active: boolean
}

export interface ApiKeyFormData {
  name: string
  permissions: ApiKeyPermission[]
}

// Analytics Types (Issue #90)
export type AnalyticsEventType = 
  | 'page_view' 
  | 'feature_usage' 
  | 'time_on_page' 
  | 'alert_created' 
  | 'export_performed' 
  | 'settings_changed'
  | 'api_key_created'
  | 'api_key_revoked'

export interface AnalyticsEvent {
  type: AnalyticsEventType
  timestamp: number
  payload?: Record<string, unknown>
}

export interface AnalyticsConsent {
  given: boolean
  timestamp: number
  version: number
}

// WebSocket Auth Types (Issue #96)
export interface WsAuthMessage {
  action: 'auth'
  token: string
}

export interface WsAuthResponseMessage {
  type: 'auth_response'
  success: boolean
  error?: string
}
