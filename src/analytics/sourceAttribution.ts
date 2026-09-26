/**
 * @file Source performance attribution (#640).
 *
 * Pure, replayable metrics ranking providers by realized accuracy (deviation
 * from the aggregate), uptime/coverage and observed latency over a window.
 */
export interface SourceObservation {
  source: string
  timestamp: number
  /** Price reported by the source; null when the source did not report. */
  price: number | null
  /** Aggregate price at the same tick. */
  aggregate: number
  latencyMs?: number | null
}

export interface AttributionResult {
  source: string
  samples: number
  /** Mean absolute deviation from aggregate, in percent (null when no reports). */
  meanDeviationPct: number | null
  /** Percent of ticks in the window where the source reported (0-100). */
  uptimePct: number
  meanLatencyMs: number | null
  /** Composite 0-100 score; weights below. */
  score: number
  rank: number
}

/** Same uptime-dominant weighting as the reliability score in utils/export.ts. */
export const ATTRIBUTION_WEIGHTS = { accuracy: 0.4, uptime: 0.45, latency: 0.15 } as const

export const ATTRIBUTION_DEFINITION =
  'Score = 45% uptime (share of ticks reporting) + 40% accuracy (100 - 10 x mean % deviation from the aggregate) + 15% latency (100 - latency ms / 10). Ties break alphabetically.'

export function attributeSources(
  obs: readonly SourceObservation[],
  windowMs: number,
  now: number,
): AttributionResult[] {
  const start = now - windowMs
  const inWin = obs.filter((o) => o.timestamp >= start && o.timestamp <= now)
  const bySource = new Map<string, SourceObservation[]>()
  for (const o of inWin) bySource.set(o.source, [...(bySource.get(o.source) ?? []), o])

  const rows = [...bySource.entries()].map(([source, list]) => {
    const reported = list.filter((o) => o.price !== null && o.aggregate !== 0)
    const devs = reported.map((o) => (Math.abs((o.price as number) - o.aggregate) / o.aggregate) * 100)
    const meanDeviationPct = devs.length ? devs.reduce((s, d) => s + d, 0) / devs.length : null
    const uptimePct = (list.filter((o) => o.price !== null).length / list.length) * 100
    const lats = list.map((o) => o.latencyMs).filter((l): l is number => typeof l === 'number')
    const meanLatencyMs = lats.length ? lats.reduce((s, l) => s + l, 0) / lats.length : null
    const accuracy = meanDeviationPct === null ? 0 : Math.max(0, 100 - meanDeviationPct * 10)
    const latency = meanLatencyMs === null ? 100 : Math.max(0, 100 - meanLatencyMs / 10)
    const score = Math.round(
      ATTRIBUTION_WEIGHTS.accuracy * accuracy +
        ATTRIBUTION_WEIGHTS.uptime * uptimePct +
        ATTRIBUTION_WEIGHTS.latency * latency,
    )
    return { source, samples: list.length, meanDeviationPct, uptimePct, meanLatencyMs, score, rank: 0 }
  })
  rows.sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}
