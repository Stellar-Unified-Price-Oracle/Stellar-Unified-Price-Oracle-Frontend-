// Price-related types — see src/types/price.ts for full documentation
export type {
  PriceData,
  PriceSyncState,
  LivePriceEntry,
  PriceHistoryEntry,
  ExcludedSourceTick,
  PriceHistoryResponse,
  SourceName,
  SourceHealth,
  WsSubscribeMessage,
  WsUnsubscribeMessage,
  WsHelloMessage,
  WsWelcomeMessage,
  WsPriceUpdate,
  WsMessage,
  WsPauseMessage,
  WsResumeMessage,
  WsPausedMessage,
  WsResumedMessage,
} from './price'

export { isPriceData, ATTRIBUTION_RING_BUFFER_SIZE } from './price'

// On-chain price / proof types — see src/types/onChainPrice.ts
export type { OnChainPriceRecord, SourceContribution, PriceProof } from './onChainPrice'
export { onChainRecordToPriceData, isSourceContribution, isPriceProof } from './onChainPrice'

// Notification channel types (#488) — see src/types/notifications.ts
export type {
  NotificationChannelId,
  TelegramChannelConfig,
  DiscordChannelConfig,
  BotSecrets,
  BotNotificationPayload,
  BotDispatchResult,
} from './notifications'
export { EMPTY_BOT_SECRETS } from './notifications'

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

/** Time window for percentage-based alerts */
export type AlertTimeWindow = '5min' | '15min' | '1hr' | '24hr'

/** Direction of price movement for percentage alerts */
export type AlertPercentageDirection = 'up' | 'down' | 'either'

/** Reference point for percentage-based calculation */
export type AlertPercentageRelativeTo = 'open' | 'previousClose' | 'movingAverage'

/** Snooze duration options */
export type AlertSnoozeDuration = '15min' | '1hr' | '4hr' | '24hr' | 'tomorrow'

// Compound conditions (#485) and escalation policies (#487) — see src/types/alerts.ts
export type {
  ConditionField,
  ConditionOperator,
  LogicOperator,
  AlertCondition,
  ConditionGroup,
  PriceEvaluationState,
  EscalationStep,
  EscalationPolicy,
  EscalationRuntimeState,
  EscalationValidationError,
} from './alerts'
export { isConditionGroup, migrateLegacyAlertConditions, validateEscalationPolicy, nextConditionId, singleConditionGroup } from './alerts'

import type { RetestState as _RetestState } from '../utils/retestDetector'
import type {
  ConditionGroup as _ConditionGroup,
  EscalationPolicy as _EscalationPolicy,
  EscalationRuntimeState as _EscalationRuntimeState,
  AlertCondition as _AlertCondition,
  LogicOperator as _LogicOperator,
  EscalationStep as _EscalationStep,
} from './alerts'
import type { NotificationChannelId as _NotificationChannelId } from './notifications'

export interface Alert {
  id: string
  assetPair: string

  // ── Absolute threshold fields ─────────────────────────────────────────────
  upperThreshold: number | null
  lowerThreshold: number | null

  // ── Alert type: one-time vs persistent (#312) ────────────────────────────
  /** If true, alert fires once then auto-disables. If false, fires every time condition is met. */
  triggerOnce: boolean
  /** Number of times this alert has been triggered (persistent alerts count up) */
  fireCount: number

  // ── Percentage-based alert fields (#307) ─────────────────────────────────
  /** Whether this is a percentage-based movement alert */
  percentageMode: boolean
  /** Percentage change threshold (e.g. 5 = 5%) */
  percentageThreshold: number | null
  /** Time window over which to measure price movement */
  percentageWindow: AlertTimeWindow | null
  /** Direction of price movement to watch for */
  percentageDirection: AlertPercentageDirection | null
  /** Reference point for percentage calculation */
  percentageRelativeTo: AlertPercentageRelativeTo | null
  /** Stored baseline price for percentage calculation (set at alert creation or window start) */
  percentageBaselinePrice: number | null
  /** Timestamp when the baseline was last recorded */
  percentageBaselineTimestamp: number | null

  // ── Snooze fields (#313) ──────────────────────────────────────────────────
  /** Unix timestamp (ms) when the snooze expires. Null if not snoozed. */
  snoozedUntil: number | null

  // ── Cooldown (#310) ────────────────────────────────────────────────────────
  /** Minimum minutes between re-fires of a persistent alert, to prevent notification spam while price oscillates around the threshold. */
  cooldownMinutes: number

  // ── Compound conditions (#485) ────────────────────────────────────────────
  /**
   * The AND/OR condition group this alert evaluates against. Populated for every
   * alert — new alerts get one built from the form on save; legacy alerts loaded
   * from storage without one are transparently migrated via
   * {@link migrateLegacyAlertConditions} the first time they're read. Kept alongside
   * (not instead of) the legacy threshold/percentage fields above, which remain the
   * source of truth for the simple-mode UI.
   */
  conditionGroup: _ConditionGroup | null

  // ── Escalation policy (#487) ──────────────────────────────────────────────
  /** Ordered notification schedule fired at increasing delays while a breach persists. */
  escalationPolicy: _EscalationPolicy | null
  /** Runtime progress through `escalationPolicy` for the current breach; null between breaches. */
  escalationState: _EscalationRuntimeState | null

  // ── Per-alert channel routing (#492) ──────────────────────────────────────
  /**
   * Channels this alert specifically routes to. `null` (or an empty array) means
   * "use the global default set" — every channel that is enabled in the
   * notification config. When set, only the listed channels are used (still
   * intersected with currently-enabled global channels at dispatch time).
   */
  channels: _NotificationChannelId[] | null

  // ── Price-level retest detection (#491) ──────────────────────────────────
  /**
   * When true the alert additionally fires on `retest` events — re-entry to the
   * breached zone after the condition exited. Off by default.
   */
  retestMode: boolean
  /** Runtime retest state-machine progress; `null` when retest tracking is idle. */
  retestState: _RetestState | null

  // ── State fields ──────────────────────────────────────────────────────────
  active: boolean
  createdAt: number
  lastTriggeredAt: number | null
}

export interface AlertFormData {
  assetPair: string
  upperThreshold: string
  lowerThreshold: string
  triggerOnce: boolean
  // Percentage alert fields
  percentageMode: boolean
  percentageThreshold: string
  percentageWindow: AlertTimeWindow
  percentageDirection: AlertPercentageDirection
  percentageRelativeTo: AlertPercentageRelativeTo
  // Cooldown (#310)
  cooldownMinutes: string

  // ── Compound condition builder (#485) ─────────────────────────────────────
  /** Extra conditions layered on top of the primary threshold/percentage field above. */
  extraConditions: _AlertCondition[]
  /** How `extraConditions` combine with the primary condition and with each other. */
  conditionsLogic: _LogicOperator

  // ── Escalation policy (#487) ──────────────────────────────────────────────
  escalationEnabled: boolean
  escalationSteps: _EscalationStep[]

  // ── Per-alert channel routing (#492) ──────────────────────────────────────
  /** Explicitly-chosen channels; empty array means "use the global defaults". */
  channels: _NotificationChannelId[]

  // ── Price-level retest detection (#491) ──────────────────────────────────
  /** Whether the alert fires on re-entry to the breached zone (retest). */
  retestMode: boolean
}

/** A single record of a fired alert, kept for the alert history log (#309). */
export interface AlertHistoryEntry {
  id: string
  alertId: string
  assetPair: string
  /** Unix timestamp (ms) when the alert fired. */
  triggeredAt: number
  /** The price that triggered the alert. */
  price: number
  triggerOnce: boolean
  percentageMode: boolean
  upperThreshold: number | null
  lowerThreshold: number | null
  percentageThreshold: number | null
  percentageWindow: AlertTimeWindow | null
  percentageDirection: AlertPercentageDirection | null
  /**
   * Present when this entry records an escalation step firing (#487) rather than
   * the alert's initial trigger — lets `AlertHistoryLog` distinguish and label them.
   */
  escalation?: { stepId: string; channel: _EscalationStep['channel']; delayMinutes: number } | null
  /** Present when this entry records a retest-triggered fire (#491). */
  retest?: { kind: 'breach' | 'exit' | 'retest'; cycle: number } | null
}

export interface AlertsContextType {
  alerts: Alert[]
  /**
   * Create a new alert.
   * Rate-limited to {@link RATE_LIMIT_CONFIGS}.alertCreate (5 per minute).
   * Returns the new Alert when allowed, or `null` when throttled.
   */
  addAlert: (
    alert: Omit<
      Alert,
      | 'id'
      | 'createdAt'
      | 'lastTriggeredAt'
      | 'fireCount'
      | 'snoozedUntil'
      | 'percentageBaselinePrice'
      | 'percentageBaselineTimestamp'
      | 'escalationState'
      | 'channels'
      | 'retestState'
    > & { channels?: Alert['channels'] },
  ) => Alert | null
  updateAlert: (id: string, updates: Partial<Omit<Alert, 'id' | 'createdAt'>>) => void
  removeAlert: (id: string) => void
  getAlertsForPair: (assetPair: string) => Alert[]
  hasAlertsForPair: (assetPair: string) => boolean
  activeCount: number
  isPanelOpen: boolean
  togglePanel: () => void
  markAsRead: (id: string) => void
  snoozeAlert: (id: string, duration: AlertSnoozeDuration) => void
  unsnoozeAlert: (id: string) => void
  reEnableAlert: (id: string) => void
  // Alert history log (#309)
  alertHistory: AlertHistoryEntry[]
  clearAlertHistory: () => void
  /** Rate-limit info for alert creation — used by UI to disable buttons and show countdown. */
  alertCreateAllowed: boolean
  alertCreateCooldownSec: number
}

// ---------------------------------------------------------------------------
// Rate-limit types
// ---------------------------------------------------------------------------

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

// ---------------------------------------------------------------------------
// Known asset pairs
// ---------------------------------------------------------------------------

/**
 * The list of known valid asset pairs recognised by the Oracle.
 * Route parameters like `/prices/:pair` are validated against this list
 * to prevent invalid or malicious inputs from reaching API calls.
 */
export const VALID_PAIRS: readonly string[] = ['XLM/USD', 'BTC/USD', 'ETH/USD', 'USDC/USD']

/**
 * Checks whether a decoded pair name (e.g. `"BTC/USD"`) is a known valid
 * asset pair. Performs a case-sensitive, exact-match comparison against
 * {@link VALID_PAIRS}.
 */
export function isValidAssetPair(pair: string): boolean {
  return VALID_PAIRS.includes(pair)
}
