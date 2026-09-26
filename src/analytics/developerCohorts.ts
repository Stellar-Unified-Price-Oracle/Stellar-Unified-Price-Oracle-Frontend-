/**
 * @file Cohort and retention analysis for developer-portal accounts (#641).
 *
 * Pure and first-party. Accounts are identified by an opaque anonymous id
 * (no PII); cohorts are the ISO-ish week (7-day bucket) of first sighting.
 */
export const DEVELOPER_FEATURES = ['docs_view', 'key_create', 'webhook_config'] as const
export type DeveloperFeature = (typeof DEVELOPER_FEATURES)[number]

export interface DeveloperEvent {
  /** Opaque anonymous id; never an email, address or name. */
  anonId: string
  timestamp: number
  feature: DeveloperFeature
}

/** Cohorts smaller than this are suppressed to avoid misleading percentages. */
export const MIN_COHORT_SIZE = 5
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface CohortRow {
  /** Start (unix ms) of the cohort week. */
  cohortStart: number
  size: number
  suppressed: boolean
  /** retention[k] = share (0-1) active in week k after first-seen; null when suppressed. */
  retention: (number | null)[]
  /** Share of cohort that touched each feature; null when suppressed. */
  adoption: Record<DeveloperFeature, number | null>
}

export function computeCohorts(events: readonly DeveloperEvent[], now: number, minSize = MIN_COHORT_SIZE): CohortRow[] {
  const first = new Map<string, number>()
  for (const e of events) first.set(e.anonId, Math.min(first.get(e.anonId) ?? Infinity, e.timestamp))
  const weekOf = (t: number) => Math.floor(t / WEEK_MS) * WEEK_MS
  const cohorts = new Map<number, string[]>()
  for (const [id, t] of first) cohorts.set(weekOf(t), [...(cohorts.get(weekOf(t)) ?? []), id])

  const active = new Map<string, Set<number>>()
  const feats = new Map<string, Set<DeveloperFeature>>()
  for (const e of events) {
    const s = active.get(e.anonId) ?? new Set<number>()
    s.add(Math.floor((weekOf(e.timestamp) - weekOf(first.get(e.anonId) as number)) / WEEK_MS))
    active.set(e.anonId, s)
    const f = feats.get(e.anonId) ?? new Set<DeveloperFeature>()
    f.add(e.feature)
    feats.set(e.anonId, f)
  }

  return [...cohorts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cohortStart, ids]) => {
      const size = ids.length
      const suppressed = size < minSize
      const weeks = Math.max(0, Math.floor((weekOf(now) - cohortStart) / WEEK_MS)) + 1
      const retention = Array.from({ length: weeks }, (_, k) =>
        suppressed ? null : ids.filter((id) => active.get(id)?.has(k)).length / size,
      )
      const adoption = {} as Record<DeveloperFeature, number | null>
      for (const f of DEVELOPER_FEATURES) {
        adoption[f] = suppressed ? null : ids.filter((id) => feats.get(id)?.has(f)).length / size
      }
      return { cohortStart, size, suppressed, retention, adoption }
    })
}

const KEY = 'spo.developerEvents.v1'
/** Local-only touchpoint recorder (localStorage); nothing leaves the browser. */
export function recordDeveloperEvent(feature: DeveloperFeature, now = Date.now()): void {
  try {
    let id = localStorage.getItem('spo.anonId')
    if (!id) {
      id = Math.random().toString(36).slice(2) + now.toString(36)
      localStorage.setItem('spo.anonId', id)
    }
    const list: DeveloperEvent[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    list.push({ anonId: id, timestamp: now, feature })
    localStorage.setItem(KEY, JSON.stringify(list.slice(-1000)))
  } catch {
    /* storage unavailable: skip */
  }
}

export function loadDeveloperEvents(): DeveloperEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
