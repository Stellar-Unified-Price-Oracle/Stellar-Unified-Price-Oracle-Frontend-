/**
 * @file Pure compound-condition evaluation (#485).
 *
 * `evaluateCompoundCondition` is the single source of truth for whether an alert's
 * condition group is currently true, given a snapshot of live price state. It has no
 * side effects and no dependency on React/storage, so it's exercised directly by
 * `alertEvaluator.test.ts`'s truth tables and reused as-is by `useAlerts`'s
 * evaluation loop.
 */
import type { AlertCondition, AlertFormData, ConditionGroup, LogicOperator, PriceEvaluationState } from '../types'
import { isConditionGroup, nextConditionId, singleConditionGroup } from '../types'

/** Evaluates a single leaf condition against the current price state. */
export function evaluateCondition(condition: AlertCondition, state: PriceEvaluationState): boolean {
  const actual =
    condition.field === 'price' ? state.price : (state.percentageChange?.[condition.window ?? '1hr'] ?? 0)

  switch (condition.operator) {
    case 'gt':
      return actual > condition.value
    case 'gte':
      return actual >= condition.value
    case 'lt':
      return actual < condition.value
    case 'lte':
      return actual <= condition.value
    case 'eq':
      return actual === condition.value
    default:
      return false
  }
}

/**
 * Evaluates a (possibly nested) condition group against `state`.
 *
 * - An `AND` group is true iff every member is true. An empty `AND` group is
 *   vacuously `true`.
 * - An `OR` group is true iff at least one member is true. An empty `OR` group is
 *   `false` (there is nothing to satisfy it).
 * - Nested groups are evaluated recursively, so arbitrary AND/OR trees are supported.
 */
export function evaluateCompoundCondition(group: ConditionGroup, state: PriceEvaluationState): boolean {
  if (group.conditions.length === 0) return group.logic === 'AND'

  const results = group.conditions.map((node) =>
    isConditionGroup(node) ? evaluateCompoundCondition(node, state) : evaluateCondition(node, state),
  )

  return group.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

/** Combines a primary leaf condition with zero or more extra conditions under `logic`. */
export function combineConditions(primary: AlertCondition, extras: AlertCondition[], logic: LogicOperator): ConditionGroup {
  if (extras.length === 0) return singleConditionGroup(primary)
  return { id: nextConditionId('grp'), logic, conditions: [primary, ...extras] }
}

/**
 * Builds the `ConditionGroup` a new/edited alert should be saved with, from the
 * `AlertModal` form state: the primary threshold/percentage field(s) plus any extra
 * conditions the user added via the condition builder (#485), combined with
 * `form.conditionsLogic`.
 *
 * Mirrors {@link migrateLegacyAlertConditions}'s semantics for the primary condition
 * (OR of both boundaries when both thresholds are set; OR of up/down when direction
 * is "either") so a freshly created alert behaves identically to a migrated legacy one
 * when no extra conditions are added.
 */
export function buildConditionGroupFromFormData(form: AlertFormData): ConditionGroup {
  const primaryConditions: AlertCondition[] = []

  if (form.percentageMode && form.percentageThreshold) {
    const threshold = Number.parseFloat(form.percentageThreshold)
    const window = form.percentageWindow
    if (form.percentageDirection !== 'down') {
      primaryConditions.push({ id: nextConditionId(), field: 'percentageChange', operator: 'gte', value: threshold, window })
    }
    if (form.percentageDirection !== 'up') {
      primaryConditions.push({ id: nextConditionId(), field: 'percentageChange', operator: 'lte', value: -threshold, window })
    }
  } else if (!form.percentageMode) {
    const upper = form.upperThreshold ? Number.parseFloat(form.upperThreshold) : null
    const lower = form.lowerThreshold ? Number.parseFloat(form.lowerThreshold) : null
    if (upper !== null) primaryConditions.push({ id: nextConditionId(), field: 'price', operator: 'gte', value: upper })
    if (lower !== null) primaryConditions.push({ id: nextConditionId(), field: 'price', operator: 'lte', value: lower })
  }

  const primaryGroup: ConditionGroup = { id: nextConditionId('grp'), logic: 'OR', conditions: primaryConditions }

  if (form.extraConditions.length === 0) return primaryGroup

  // Fold the primary group and every extra condition into one top-level group under
  // the user's chosen logic operator. The primary group is nested as-is so its
  // internal OR (either-boundary / either-direction) semantics are preserved even
  // when combined with extras via AND.
  return { id: nextConditionId('grp'), logic: form.conditionsLogic, conditions: [primaryGroup, ...form.extraConditions] }
}
