import { z } from 'zod'

/**
 * Strict Zod schema for {@link import('../types/price').PriceData}.
 * All fields are required. Extra properties are stripped.
 */
export const PriceDataSchema = z.object({
  assetPair: z.string().min(1),
  price: z.number().finite(),
  timestamp: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string().min(1)),
})

/**
 * Strict Zod schema for {@link import('../types/price').PriceHistoryEntry}.
 * All fields are required. Extra properties are stripped.
 * `excludedSources` is optional — present only when the API includes exclusion metadata (#461).
 */
export const ExcludedSourceTickSchema = z.object({
  source: z.string().min(1),
  reportedPrice: z.number().finite(),
  reason: z.string(),
})

export const PriceHistoryEntrySchema = z.object({
  price: z.number().finite(),
  timestamp: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string().min(1)),
  excludedSources: z.array(ExcludedSourceTickSchema).optional(),
})

export const PriceHistoryResponseSchema = z.object({
  pair: z.string(),
  history: z.array(PriceHistoryEntrySchema),
})

export const BatchHistoryResponseSchema = z.array(PriceHistoryResponseSchema)

export const HealthSchema = z.object({
  status: z.string(),
  uptime: z.number(),
})

/**
 * Strict Zod schema for {@link import('../types/onchain').OnChainPriceRecord}.
 * All fields are required. Extra properties are stripped.
 */
export const OnChainPriceRecordSchema = z.object({
  asset: z.string().min(1),
  network: z.enum(['mainnet', 'testnet', 'futurenet']),
  contractId: z.string().min(1),
  price: z.number().finite(),
  publishedAt: z.number().int().min(0),
  ledger: z.number().int().min(0),
})

// ── Compound condition / escalation schemas (#485, #487) ─────────────────────

const AlertConditionSchema = z.object({
  id: z.string(),
  field: z.enum(['price', 'percentageChange']),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
  value: z.number().finite(),
  window: z.enum(['5min', '15min', '1hr', '24hr']).optional(),
})

/** Recursive AND/OR condition group — a node is either a leaf condition or a nested group. */
const ConditionGroupSchema: z.ZodType<{
  id: string
  logic: 'AND' | 'OR'
  conditions: Array<z.infer<typeof AlertConditionSchema> | { id: string; logic: 'AND' | 'OR'; conditions: unknown[] }>
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    logic: z.enum(['AND', 'OR']),
    conditions: z.array(z.union([AlertConditionSchema, ConditionGroupSchema])),
  }),
)

const NotificationChannelIdSchema = z.enum(['inApp', 'email', 'webPush', 'webhook', 'telegram', 'discord'])

const EscalationStepSchema = z.object({
  id: z.string(),
  channel: NotificationChannelIdSchema,
  delayMinutes: z.number().min(0),
})

const EscalationPolicySchema = z.object({
  enabled: z.boolean(),
  steps: z.array(EscalationStepSchema),
})

const EscalationRuntimeStateSchema = z.object({
  breachStartedAt: z.number(),
  firedStepIds: z.array(z.string()),
})

// Runtime retest state machine progress (#491) — see utils/retestDetector.ts.
const RetestPhaseSchema = z.enum(['idle', 'inBreach', 'exited'])
const RetestStateSchema = z.object({
  phase: RetestPhaseSchema,
  cycles: z.number().int().min(0),
  lastEventPrice: z.number(),
  lastEventAt: z.number(),
})

// ── Alert schema (localStorage deserialization) ──────────────────────────────

export const AlertSchema = z.object({
  id: z.string(),
  assetPair: z.string(),

  // Absolute threshold fields
  upperThreshold: z.number().nullable(),
  lowerThreshold: z.number().nullable(),

  // Alert type: one-time vs persistent (#312)
  triggerOnce: z.boolean(),
  fireCount: z.number().int().min(0).default(0),

  // Percentage-based alert fields (#307)
  percentageMode: z.boolean().default(false),
  percentageThreshold: z.number().nullable().default(null),
  percentageWindow: z.enum(['5min', '15min', '1hr', '24hr']).nullable().default(null),
  percentageDirection: z.enum(['up', 'down', 'either']).nullable().default(null),
  percentageRelativeTo: z.enum(['open', 'previousClose', 'movingAverage']).nullable().default(null),
  percentageBaselinePrice: z.number().nullable().default(null),
  percentageBaselineTimestamp: z.number().nullable().default(null),

  // Snooze fields (#313)
  snoozedUntil: z.number().nullable().default(null),

  // Cooldown (#310) — minutes between re-fires of a persistent alert
  cooldownMinutes: z.number().min(0).default(5),

  // Compound conditions (#485) — absent on legacy records, filled in by
  // `migrateLegacyAlertConditions` the first time useAlerts loads them.
  conditionGroup: ConditionGroupSchema.nullable().default(null),

  // Escalation policy (#487)
  escalationPolicy: EscalationPolicySchema.nullable().default(null),
  escalationState: EscalationRuntimeStateSchema.nullable().default(null),

  // Per-alert channel routing (#492) — null/absent means "use global defaults".
  channels: z.array(NotificationChannelIdSchema).nullable().default(null),

  // Price-level retest detection (#491)
  retestMode: z.boolean().default(false),
  retestState: RetestStateSchema.nullable().default(null),

  // State fields
  active: z.boolean(),
  createdAt: z.number(),
  lastTriggeredAt: z.number().nullable(),
})

export const AlertsArraySchema = z.array(AlertSchema)

// ── Alert history schema (localStorage deserialization, #309) ────────────────

export const AlertHistoryEntrySchema = z.object({
  id: z.string(),
  alertId: z.string(),
  assetPair: z.string(),
  triggeredAt: z.number(),
  price: z.number(),
  triggerOnce: z.boolean(),
  percentageMode: z.boolean().default(false),
  upperThreshold: z.number().nullable().default(null),
  lowerThreshold: z.number().nullable().default(null),
  percentageThreshold: z.number().nullable().default(null),
  percentageWindow: z.enum(['5min', '15min', '1hr', '24hr']).nullable().default(null),
  percentageDirection: z.enum(['up', 'down', 'either']).nullable().default(null),
  // Escalation step metadata (#487) — present only on escalation-fired entries.
  escalation: z
    .object({ stepId: z.string(), channel: NotificationChannelIdSchema, delayMinutes: z.number() })
    .nullable()
    .optional(),
  // Retest-triggered fire metadata (#491).
  retest: z
    .object({ kind: z.enum(['breach', 'exit', 'retest']), cycle: z.number() })
    .nullable()
    .optional(),
})

export const AlertHistoryArraySchema = z.array(AlertHistoryEntrySchema)

// ── WebSocket message schemas ────────────────────────────────────────────────

export const WsPriceUpdateSchema = z.object({
  type: z.literal('price_update'),
  assetPair: z.string(),
  price: z.number(),
  timestamp: z.number(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
  /**
   * Optional per-source prices provided by the server.
   * Keys are source names; values are individual source prices.
   */
  sourcePrices: z.record(z.string(), z.number()).optional(),
  /** Optional monotonic sequence number for duplicate detection. */
  seq: z.number().optional(),
})

/** Server handshake response confirming the WS protocol version (#472). */
export const WsWelcomeMessageSchema = z.object({
  type: z.literal('welcome'),
  protocolVersion: z.number().int().min(0),
})

/** Server ack confirming inbound updates were paused/resumed for this connection (#469). */
export const WsPausedMessageSchema = z.object({ type: z.literal('paused') })
export const WsResumedMessageSchema = z.object({ type: z.literal('resumed') })

/**
 * Discriminated union of all known WebSocket message types.
 * Add new variants here as the server protocol evolves.
 */
export const WsMessageSchema = z.discriminatedUnion('type', [
  WsPriceUpdateSchema,
  WsWelcomeMessageSchema,
  WsPausedMessageSchema,
  WsResumedMessageSchema,
])

// ── Type inference from schemas ──────────────────────────────────────────────

export type PriceDataFromSchema = z.infer<typeof PriceDataSchema>
export type PriceHistoryResponseFromSchema = z.infer<typeof PriceHistoryResponseSchema>
export type BatchHistoryResponseFromSchema = z.infer<typeof BatchHistoryResponseSchema>
export type AlertFromSchema = z.infer<typeof AlertSchema>
export type AlertHistoryEntryFromSchema = z.infer<typeof AlertHistoryEntrySchema>
export type WsMessageFromSchema = z.infer<typeof WsMessageSchema>
export type PriceProofFromSchema = z.infer<typeof PriceProofSchema>
