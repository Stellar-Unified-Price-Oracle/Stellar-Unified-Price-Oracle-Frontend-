/**
 * @file Compound condition & escalation policy types (#485, #487).
 *
 * Extends the base alert model (see `src/types/index.ts`) with:
 *  - A recursive AND/OR condition group schema, so an alert can require several
 *    conditions to hold at once (or any one of several) instead of a single
 *    threshold/percentage check.
 *  - An escalation policy: an ordered sequence of notification channels fired at
 *    increasing delays while a breach stays active.
 *
 * `migrateLegacyAlertConditions` bridges old (pre-#485) alerts — which only had
 * `upperThreshold`/`lowerThreshold`/percentage fields — into the new condition-group
 * shape, so evaluation code has a single code path regardless of an alert's age.
 */
import type { Alert, AlertPercentageDirection, AlertTimeWindow } from './index'
import type { NotificationChannelId } from './notifications'

// ---------------------------------------------------------------------------
// Compound conditions (#485)
// ---------------------------------------------------------------------------

/** What a single condition compares against. */
export type ConditionField = 'price' | 'percentageChange'

/** Comparison operator for a single condition. */
export type ConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

/** Boolean combinator for a condition group. */
export type LogicOperator = 'AND' | 'OR'

/** A single leaf condition, e.g. "price >= 70000" or "percentageChange <= -5 over 1hr". */
export interface AlertCondition {
  id: string
  field: ConditionField
  operator: ConditionOperator
  value: number
  /** Only meaningful when `field === 'percentageChange'`. Defaults to '1hr'. */
  window?: AlertTimeWindow
}

/**
 * A group of conditions (and/or nested sub-groups) combined by `logic`.
 * An empty `conditions` array is vacuously `true` for `AND` and `false` for `OR`,
 * matching standard boolean-algebra convention.
 */
export interface ConditionGroup {
  id: string
  logic: LogicOperator
  conditions: Array<AlertCondition | ConditionGroup>
}

/** Type guard distinguishing a nested group from a leaf condition. */
export function isConditionGroup(node: AlertCondition | ConditionGroup): node is ConditionGroup {
  return 'logic' in node && 'conditions' in node
}

/** Live market state a compound condition is evaluated against. */
export interface PriceEvaluationState {
  price: number
  /** Percentage change keyed by time window, when known. */
  percentageChange?: Partial<Record<AlertTimeWindow, number>>
}

let conditionIdCounter = 0

/** Generates a reasonably unique id for a condition/group without pulling in a uuid dependency. */
export function nextConditionId(prefix = 'cond'): string {
  conditionIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${conditionIdCounter}`
}

/** Builds a single-leaf AND group — the shape a legacy alert's one condition becomes. */
export function singleConditionGroup(condition: AlertCondition): ConditionGroup {
  return { id: nextConditionId('grp'), logic: 'AND', conditions: [condition] }
}

/**
 * Transparent migration (#485): maps a legacy alert's threshold/percentage fields
 * into a `ConditionGroup`, with no data loss and no user-visible change in behaviour.
 *
 * - Absolute mode with both thresholds set becomes an OR of the two boundary checks,
 *   matching the pre-#485 evaluation semantics (fires when price crosses either one).
 * - Percentage mode with `direction: 'either'` becomes an OR of the up/down checks.
 *
 * Pure function — safe to call on every load without mutating the source alert.
 */
export function migrateLegacyAlertConditions(
  alert: Pick<
    Alert,
    | 'percentageMode'
    | 'upperThreshold'
    | 'lowerThreshold'
    | 'percentageThreshold'
    | 'percentageWindow'
    | 'percentageDirection'
  >,
): ConditionGroup {
  if (alert.percentageMode) {
    const threshold = alert.percentageThreshold ?? 0
    const window = alert.percentageWindow ?? '1hr'
    const direction: AlertPercentageDirection = alert.percentageDirection ?? 'either'

    const up: AlertCondition = { id: nextConditionId(), field: 'percentageChange', operator: 'gte', value: threshold, window }
    const down: AlertCondition = { id: nextConditionId(), field: 'percentageChange', operator: 'lte', value: -threshold, window }

    if (direction === 'up') return singleConditionGroup(up)
    if (direction === 'down') return singleConditionGroup(down)
    return { id: nextConditionId('grp'), logic: 'OR', conditions: [up, down] }
  }

  const conditions: AlertCondition[] = []
  if (alert.upperThreshold !== null) {
    conditions.push({ id: nextConditionId(), field: 'price', operator: 'gte', value: alert.upperThreshold })
  }
  if (alert.lowerThreshold !== null) {
    conditions.push({ id: nextConditionId(), field: 'price', operator: 'lte', value: alert.lowerThreshold })
  }

  if (conditions.length === 0) {
    // No threshold configured at all — an always-false placeholder group rather
    // than throwing, so a malformed legacy record doesn't crash evaluation.
    return { id: nextConditionId('grp'), logic: 'OR', conditions: [] }
  }
  if (conditions.length === 1) return singleConditionGroup(conditions[0])
  // Both set: legacy semantics fire on crossing *either* boundary (never "between").
  return { id: nextConditionId('grp'), logic: 'OR', conditions }
}

// ---------------------------------------------------------------------------
// Escalation policies (#487)
// ---------------------------------------------------------------------------

/** A single escalation step: notify `channel` once the breach has lasted `delayMinutes`. */
export interface EscalationStep {
  id: string
  channel: NotificationChannelId
  /** Minutes after the breach began (0 = immediate). */
  delayMinutes: number
}

export interface EscalationPolicy {
  enabled: boolean
  /** Ordered by `delayMinutes`, non-decreasing — see {@link validateEscalationPolicy}. */
  steps: EscalationStep[]
}

/** Per-alert runtime bookkeeping for an in-progress breach, reset once the condition clears. */
export interface EscalationRuntimeState {
  /** Timestamp (ms) the current breach began. */
  breachStartedAt: number
  /** Ids of steps already fired for this breach. */
  firedStepIds: string[]
}

/** One validation problem found in an escalation policy's step sequence. */
export interface EscalationValidationError {
  /** 0-based index of the offending step. */
  stepIndex: number
  /** Machine-readable reason, for the UI to localize (see `alertModal.escalation.error_*`). */
  code: 'invalidDelay' | 'outOfOrder'
}

/**
 * Validates an escalation policy's step sequence — every delay must be a
 * non-negative number of minutes, and delays must be non-decreasing (each step
 * fires no earlier than the one before it). Returns the list of problems found
 * (empty when valid). Used by both the {@link EscalationPolicyBuilder} form and as
 * a defensive check before an alert is persisted.
 */
export function validateEscalationPolicy(steps: EscalationStep[]): EscalationValidationError[] {
  const errors: EscalationValidationError[] = []
  if (steps.length === 0) return errors

  let previousDelay = -Infinity
  for (const [stepIndex, step] of steps.entries()) {
    if (!Number.isFinite(step.delayMinutes) || step.delayMinutes < 0) {
      errors.push({ stepIndex, code: 'invalidDelay' })
    } else if (step.delayMinutes < previousDelay) {
      errors.push({ stepIndex, code: 'outOfOrder' })
    } else {
      previousDelay = step.delayMinutes
    }
  }
  return errors
}
