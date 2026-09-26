/**
 * @file Alert delivery latency SLO (#652).
 *
 * Measures threshold-crossing -> notification-dispatched latency by recording
 * into the existing latency monitor (no new timer), keyed by
 * `alert-delivery:<ruleClass>:<channel>` so p50/p95 come from `getLatencyStats`.
 * Only class/channel labels and durations are stored (no prices, ids or URLs);
 * the monitor caps its buffer, so the measurement is bounded.
 *
 * SLO breaches are reported through a dedicated synchronous listener list that
 * is independent of the alert delivery path, so the meta-alert is never delayed
 * by a backed-up channel.
 */
import { getLatencyStats, recordLatency, type LatencyStats } from './latencyMonitor'

export type RuleClass = 'threshold' | 'percentage' | 'compound'

export const ALERT_SLO = { p95Ms: 5000, minSamples: 5 } as const

export interface SloBreach {
  ruleClass: RuleClass
  channel: string
  p95: number
  targetMs: number
  at: number
}

const sloEndpoint = (c: RuleClass, ch: string) => `alert-delivery:${c}:${ch}`
const breachListeners = new Set<(b: SloBreach) => void>()

export function onSloBreach(l: (b: SloBreach) => void): () => void {
  breachListeners.add(l)
  return () => breachListeners.delete(l)
}

/** Record one crossing->dispatch measurement and fire a meta-alert synchronously on breach. */
export function recordAlertDispatch(
  ruleClass: RuleClass,
  channel: string,
  crossedAt: number,
  dispatchedAt: number = Date.now(),
  targetMs: number = ALERT_SLO.p95Ms,
): SloBreach | null {
  const ms = Math.max(0, dispatchedAt - crossedAt)
  recordLatency(sloEndpoint(ruleClass, channel), ms, ms <= targetMs)
  const stats = getLatencyStats(sloEndpoint(ruleClass, channel))
  if (stats.count >= ALERT_SLO.minSamples && stats.p95 !== null && stats.p95 > targetMs) {
    const breach: SloBreach = { ruleClass, channel, p95: stats.p95, targetMs, at: dispatchedAt }
    breachListeners.forEach((l) => l(breach))
    return breach
  }
  return null
}

export function getAlertLatencyStats(ruleClass: RuleClass, channel: string): LatencyStats {
  return getLatencyStats(sloEndpoint(ruleClass, channel))
}
