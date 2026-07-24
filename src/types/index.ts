// Price-related types — see src/types/price.ts for full documentation
export type {
  PriceData,
  PriceSyncState,
  LivePriceEntry,
  PriceHistoryEntry,
  PriceHistoryResponse,
  SourceName,
  SourceHealth,
  WsSubscribeMessage,
  WsUnsubscribeMessage,
  WsPriceUpdate,
  WsMessage,
} from './price'

export { isPriceData } from './price'

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Rate-limit types
// ---------------------------------------------------------------------------

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}
