/**
 * @file Source health derivation.
 *
 * Single source of truth for turning a price snapshot into the per-source
 * {@link SourceHealth} records that feed {@link computeSourceMetrics} and the
 * ReliabilityLeaderboard. Both the Dashboard and the Governance page must use
 * this helper — if each derived its own numbers they could disagree, and a
 * governance metric that contradicts the dashboard is worse than no metric.
 */
import type { PriceData, SourceHealth, SourceName } from '../types'

/** The oracle sources the aggregator is expected to report on. */
export const KNOWN_SOURCES: readonly SourceName[] = ['chainlink', 'redstone', 'band', 'reflector']

/**
 * Derives a {@link SourceHealth} record for every known source from the current
 * price snapshot.
 *
 * ## Provenance (read before displaying these numbers)
 *
 * These records are **client-observed**, not authoritative:
 *
 * - `status` is `'healthy'` whenever the source appears in at least one current
 *   price and `'down'` otherwise. We never observe `'degraded'` here because the
 *   REST payload carries no partial-health signal.
 * - `latency` is **synthesised from staleness** (`now - lastUpdate`, clamped to
 *   12–250 ms) because the price API does not expose a measured round-trip time.
 *   It must never be labelled or exported as measured latency.
 *
 * Consumers that present these values must surface that caveat rather than
 * implying they came from the aggregator's own monitoring.
 *
 * @param prices Current price snapshots (one per asset pair).
 * @param now    Reference timestamp; injectable so tests are deterministic.
 */
export function deriveSourceHealths(prices: readonly PriceData[], now: number = Date.now()): SourceHealth[] {
  return KNOWN_SOURCES.map((source) => {
    const active = prices.filter((p) => p.sources.includes(source))
    const lastUpdate = active.length > 0 ? Math.max(...active.map((p) => p.timestamp)) : null
    return {
      source,
      status: active.length > 0 ? 'healthy' : 'down',
      lastUpdate,
      latency: lastUpdate !== null ? Math.max(12, Math.min(250, now - lastUpdate)) : null,
    }
  })
}
