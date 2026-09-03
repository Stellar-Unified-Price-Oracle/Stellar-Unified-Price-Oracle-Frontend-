/**
 * @file Alert simulation mode (#490).
 *
 * Replays a synthetic price series through the *same* evaluation functions the
 * live alert engine uses (`buildConditionGroupFromFormData` → `evaluateCompoundCondition`),
 * so simulation results are identical to what would happen live. Pure — no state,
 * no storage, nothing leaks into alert history.
 *
 * `simulateAlert` returns a series where each point carries a `fired` flag plus an
 * index into the series, so the UI can mark exactly where the alert would have
 * fired on a mini-chart.
 */
import type { AlertFormData, PriceEvaluationState } from '../types'
import { buildConditionGroupFromFormData, evaluateCompoundCondition } from './alertEvaluator'

/** A synthetic price point replayed through the alert's evaluation. */
export interface SimulatedPoint {
  /** Index into the series (0-based). */
  index: number
  price: number
  /** Whether the alert's condition was true at this point. */
  fired: boolean
}

/** Number of synthetic points to replay. */
export const SIMULATION_POINTS = 60
/** Dead-band used to force re-crossings of the threshold(s) so markers appear. */
export const SIMULATION_AMPLITUDE_RATIO = 0.6

/** Percentage-change window folded in when the form is in percentage mode. */
function formWindow(form: AlertFormData): string {
  return form.percentageWindow || '1hr'
}

/**
 * The baseline price the synthetic series oscillates around — the first series
 * value. Mirrors how the live engine anchors percentage alerts to a baseline.
 */
function seriesBaseline(currentPrice: number, targetPrice: number): number {
  // Place the series so it oscillates across `targetPrice`, centred between the
  // current price and the target so it crosses the threshold repeatedly.
  return (currentPrice + targetPrice) / 2
}

/**
 * Deterministically generates a price series that oscillates around a target.
 * The sine wave guarantees multiple crossings of both the current price and the
 * target, so a threshold alert is guaranteed to fire more than once.
 */
export function generateSyntheticSeries(
  form: AlertFormData,
  currentPrice: number,
  points: number = SIMULATION_POINTS,
): number[] {
  // Pick the "target" price to cross: an absolute threshold if set, else a price
  // derived from the percentage threshold relative to the current price.
  let targetPrice = currentPrice
  const upper = form.upperThreshold ? Number.parseFloat(form.upperThreshold) : null
  const lower = form.lowerThreshold ? Number.parseFloat(form.lowerThreshold) : null
  const pct = form.percentageThreshold ? Number.parseFloat(form.percentageThreshold) : null

  if (form.percentageMode && pct !== null && pct > 0) {
    targetPrice = form.percentageDirection === 'down'
      ? currentPrice * (1 - pct / 100)
      : currentPrice * (1 + pct / 100)
  } else if (lower !== null && upper !== null) {
    targetPrice = (lower + upper) / 2
  } else if (upper !== null) {
    targetPrice = upper
  } else if (lower !== null) {
    targetPrice = lower
  }

  if (currentPrice <= 0 || targetPrice <= 0) {
    // Degenerate input — just repeat the current price so nothing crashes.
    return Array.from({ length: points }, () => currentPrice)
  }

  const baseline = seriesBaseline(currentPrice, targetPrice)
  const amplitude = Math.abs(targetPrice - currentPrice) * SIMULATION_AMPLITUDE_RATIO || currentPrice * 0.02
  // Lift so the sine actually crosses `target` (not just touch it).
  const phase = Math.PI / 2

  return Array.from({ length: points }, (_, i) => {
    const wave = baseline + amplitude * Math.sin((i / points) * Math.PI * 4 + phase)
    return Number(wave.toFixed(6))
  })
}

/**
 * Replays a synthetic series through the production evaluation path and returns
 * per-point fire flags. Pure — callers must not persist the output.
 */
export function simulateAlert(
  form: AlertFormData,
  currentPrice: number,
  points = SIMULATION_POINTS,
): SimulatedPoint[] {
  const series = generateSyntheticSeries(form, currentPrice, points)
  const group = buildConditionGroupFromFormData(form)
  const baseline = series[0] ?? currentPrice
  const window = formWindow(form)

  return series.map((price, index) => {
    const state: PriceEvaluationState = form.percentageMode
      ? {
          price,
          percentageChange: {
            [window]: baseline !== 0 ? ((price - baseline) / baseline) * 100 : 0,
          },
        }
      : { price }

    return { index, price, fired: evaluateCompoundCondition(group, state) }
  })
}

/** Convenience helper: sum of points that would have fired. */
export function countSimulatedFires(points: SimulatedPoint[]): number {
  return points.filter((p) => p.fired).length
}