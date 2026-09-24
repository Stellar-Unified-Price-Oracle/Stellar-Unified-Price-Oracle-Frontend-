/**
 * @file Alert health checks (#493).
 *
 * A misconfigured alert (an impossible threshold, or a percentage move that has
 * never happened) can silently never fire — the user assumes coverage that
 * doesn't exist. This module is a pure analysis pass: given an alert's condition
 * leaves and a window of observed price history for its pair, it decides whether
 * the condition has ever been (or could ever have been) satisfied, and suggests a
 * corrected threshold grounded in the observed distribution.
 *
 * No side effects, no storage, no notifications — `useAlertHealth` wires this to
 * real data and persistence; `AlertPanel` renders the result. Kept side-effect
 * free so the flagging logic is exhaustively unit-testable like `alertEvaluator.ts`.
 */
import type { Alert, AlertCondition, ConditionGroup } from '../types'
import { isConditionGroup } from '../types/alerts'

/** Minimum number of observed history points before a health verdict is trusted. */
export const MIN_HISTORY_SAMPLES = 10

/** Percentile summary of an observed value distribution. */
export interface Percentiles {
  min: number
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
  max: number
}

/** Linear-interpolation percentile of a *sorted ascending* array. */
function percentileOf(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const frac = idx - lo
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

/** Computes min/p5/p25/p50/p75/p95/max over `values`. Empty input yields all-zero percentiles. */
export function computePercentiles(values: number[]): Percentiles {
  if (values.length === 0) {
    return { min: 0, p5: 0, p25: 0, p50: 0, p75: 0, p95: 0, max: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  return {
    min: sorted[0],
    p5: percentileOf(sorted, 5),
    p25: percentileOf(sorted, 25),
    p50: percentileOf(sorted, 50),
    p75: percentileOf(sorted, 75),
    p95: percentileOf(sorted, 95),
    max: sorted[sorted.length - 1],
  }
}

/** Why a single condition leaf was flagged. */
export type AlertHealthReasonCode = 'insufficientHistory' | 'thresholdNeverSatisfiable'

/** One flagged condition leaf, with a suggested replacement value grounded in history. */
export interface AlertHealthIssue {
  conditionId: string
  field: AlertCondition['field']
  operator: AlertCondition['operator']
  configuredValue: number
  reason: AlertHealthReasonCode
  /** Percentile-based suggestion for `configuredValue`, absent when there isn't enough history to suggest one. */
  suggestedValue: number | null
}

/** Aggregate health verdict for one alert. `null` (via {@link checkAlertHealth}) means healthy. */
export interface AlertHealthFlag {
  alertId: string
  assetPair: string
  issues: AlertHealthIssue[]
  checkedAt: number
}

/** Walks a condition tree and returns every leaf condition. */
function flattenConditions(group: ConditionGroup): AlertCondition[] {
  const leaves: AlertCondition[] = []
  for (const node of group.conditions) {
    if (isConditionGroup(node)) leaves.push(...flattenConditions(node))
    else leaves.push(node)
  }
  return leaves
}

/**
 * Whether `operator value` could ever be satisfied against a distribution whose
 * observed range is `[min, max]`. `eq` is treated as satisfiable only if the exact
 * value fell within the observed range (a strict equality is otherwise vanishingly
 * unlikely to ever hold, which is itself a useful flag).
 */
function isSatisfiable(operator: AlertCondition['operator'], value: number, min: number, max: number): boolean {
  switch (operator) {
    case 'gt':
      return max > value
    case 'gte':
      return max >= value
    case 'lt':
      return min < value
    case 'lte':
      return min <= value
    case 'eq':
      return value >= min && value <= max
  }
}

/** Suggests a replacement threshold at the percentile that keeps the alert meaningfully selective. */
function suggestValue(operator: AlertCondition['operator'], pct: Percentiles): number {
  switch (operator) {
    case 'gt':
    case 'gte':
      return pct.p95
    case 'lt':
    case 'lte':
      return pct.p5
    case 'eq':
      return pct.p50
  }
}

/**
 * Evaluates one condition leaf against the observed distribution for its field.
 * `priceHistory` and `pctChangeHistory` are pre-extracted samples for the alert's
 * pair (price levels and, separately, percentage-change magnitudes over the
 * relevant window) — see `useAlertHealth` for how they're built from real history.
 */
function checkCondition(
  condition: AlertCondition,
  priceHistory: number[],
  pctChangeHistory: number[],
): AlertHealthIssue | null {
  const samples = condition.field === 'price' ? priceHistory : pctChangeHistory
  if (samples.length < MIN_HISTORY_SAMPLES) {
    return {
      conditionId: condition.id,
      field: condition.field,
      operator: condition.operator,
      configuredValue: condition.value,
      reason: 'insufficientHistory',
      suggestedValue: null,
    }
  }

  const pct = computePercentiles(samples)
  if (isSatisfiable(condition.operator, condition.value, pct.min, pct.max)) return null

  return {
    conditionId: condition.id,
    field: condition.field,
    operator: condition.operator,
    configuredValue: condition.value,
    reason: 'thresholdNeverSatisfiable',
    suggestedValue: suggestValue(condition.operator, pct),
  }
}

/**
 * Runs the health check for one alert. Returns `null` when the alert is healthy
 * (every condition leaf has either enough satisfiable range or too little history
 * to judge is intentionally *not* flagged as unhealthy — insufficient history is
 * reported separately from "never satisfiable" via `reason`, both surfaced so the
 * UI can distinguish "can't tell yet" from "this will never fire").
 *
 * Never-flags alerts that are disabled, snoozed, or without a condition group —
 * there's nothing actionable to review for those.
 */
export function checkAlertHealth(
  alert: Alert,
  priceHistory: number[],
  pctChangeHistory: number[],
  now = Date.now(),
): AlertHealthFlag | null {
  if (!alert.active || !alert.conditionGroup) return null

  const issues = flattenConditions(alert.conditionGroup)
    .map((c) => checkCondition(c, priceHistory, pctChangeHistory))
    .filter((issue): issue is AlertHealthIssue => issue !== null)
    // Insufficient-history issues are only worth surfacing when nothing else was
    // learned about the alert — a single "never satisfiable" leaf is the actionable
    // signal; drop the noise once we have that.
    .filter((issue, _i, all) =>
      all.some((x) => x.reason === 'thresholdNeverSatisfiable') ? issue.reason === 'thresholdNeverSatisfiable' : true,
    )

  if (issues.length === 0) return null
  return { alertId: alert.id, assetPair: alert.assetPair, issues, checkedAt: now }
}
