/**
 * @file Alert rule testing playground (#649).
 *
 * Dry-runs a drafted rule against a real historical tick window through the same
 * evaluation path as live alerts. Pure: no notifications, no storage, no network.
 * Deterministic: when the window exceeds `maxPoints` it is downsampled with a
 * seeded PRNG, so the same seed always yields identical results.
 */
import type { AlertFormData, PriceEvaluationState } from '../types'
import { buildConditionGroupFromFormData, evaluateCompoundCondition } from './alertEvaluator'

export interface HistoricalTick {
  /** Epoch ms. */
  timestamp: number
  price: number
}

export interface PlaygroundFire {
  index: number
  timestamp: number
  price: number
}

export interface PlaygroundResult {
  /** Always true: nothing is dispatched during a playground run. */
  dryRun: true
  fires: PlaygroundFire[]
  fireCount: number
  firstFireAt: number | null
  lastFireAt: number | null
  /** Milliseconds the condition was true, summed across consecutive ticks. */
  timeInBreachedMs: number
  ticksEvaluated: number
}

export interface PlaygroundOptions {
  seed?: number
  maxPoints?: number
  /** Inclusive window bounds (epoch ms). */
  from?: number
  to?: number
}

/** Small deterministic PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function downsample(ticks: HistoricalTick[], max: number, seed: number): HistoricalTick[] {
  if (ticks.length <= max) return ticks
  const rnd = seededRandom(seed)
  const keep = new Set<number>([0, ticks.length - 1])
  while (keep.size < max) keep.add(Math.floor(rnd() * ticks.length))
  return [...keep].sort((a, b) => a - b).map((i) => ticks[i])
}

export function runAlertPlayground(
  form: AlertFormData,
  history: HistoricalTick[],
  opts: PlaygroundOptions = {},
): PlaygroundResult {
  const { seed = 1, maxPoints = 2000, from = -Infinity, to = Infinity } = opts
  const windowed = history
    .filter((t) => t.timestamp >= from && t.timestamp <= to && Number.isFinite(t.price))
    .sort((a, b) => a.timestamp - b.timestamp)
  const ticks = downsample(windowed, maxPoints, seed)
  const group = buildConditionGroupFromFormData(form)
  const win = form.percentageWindow || '1hr'
  const baseline = ticks[0]?.price ?? 0

  const fires: PlaygroundFire[] = []
  let breachedMs = 0
  let prevFired = false
  let prevTs = 0
  ticks.forEach((t, index) => {
    const state: PriceEvaluationState = form.percentageMode
      ? { price: t.price, percentageChange: { [win]: baseline ? ((t.price - baseline) / baseline) * 100 : 0 } }
      : { price: t.price }
    const fired = evaluateCompoundCondition(group, state)
    if (prevFired) breachedMs += t.timestamp - prevTs
    if (fired && !prevFired) fires.push({ index, timestamp: t.timestamp, price: t.price })
    prevFired = fired
    prevTs = t.timestamp
  })

  return {
    dryRun: true,
    fires,
    fireCount: fires.length,
    firstFireAt: fires[0]?.timestamp ?? null,
    lastFireAt: fires[fires.length - 1]?.timestamp ?? null,
    timeInBreachedMs: breachedMs,
    ticksEvaluated: ticks.length,
  }
}
