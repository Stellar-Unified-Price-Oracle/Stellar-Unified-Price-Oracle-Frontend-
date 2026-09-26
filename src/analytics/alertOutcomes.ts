/**
 * @file Alert outcome analytics v2 (#642): precision by rule type with tuning suggestions.
 *
 * Outcomes are not stored on AlertHistoryEntry today, so callers supply them as
 * `AlertOutcomeRecord`s (keyed by history entry id). Pure and side-effect free.
 */
import type { AlertHistoryEntry } from '../types'

export type RuleType = 'threshold_upper' | 'threshold_lower' | 'percentage'
export type AlertOutcome = 'acted_on' | 'dismissed' | 'retriggered'
export type FalsePositiveReason = 'dismissed_quickly' | 'retrigger_noise' | 'too_close_to_price' | 'unspecified'

export interface AlertOutcomeRecord {
  entryId: string
  outcome: AlertOutcome
  /** Ms between fire and user action, when known. */
  reactionMs?: number
}

export interface RuleTypeStats {
  ruleType: RuleType
  fired: number
  actedOn: number
  /** actedOn / fired, null when no fires. */
  precision: number | null
  falsePositiveReasons: Partial<Record<FalsePositiveReason, number>>
}

export interface TuningSuggestion {
  ruleType: RuleType
  kind: 'threshold' | 'window' | 'condition'
  message: string
}

export function ruleTypeOf(e: AlertHistoryEntry): RuleType {
  if (e.percentageMode) return 'percentage'
  return e.upperThreshold !== null ? 'threshold_upper' : 'threshold_lower'
}

/** Distance of the firing price from the threshold as a fraction of the threshold. */
export function thresholdDistance(e: AlertHistoryEntry): number | null {
  const t = e.upperThreshold ?? e.lowerThreshold
  if (e.percentageMode || t === null || t === 0) return null
  return Math.abs(e.price - t) / Math.abs(t)
}

function reasonFor(e: AlertHistoryEntry, r: AlertOutcomeRecord): FalsePositiveReason {
  if (r.outcome === 'retriggered') return 'retrigger_noise'
  const d = thresholdDistance(e)
  if (d !== null && d < 0.005) return 'too_close_to_price'
  if (r.reactionMs !== undefined && r.reactionMs < 10_000) return 'dismissed_quickly'
  return 'unspecified'
}

export function computeRuleTypePrecision(
  history: readonly AlertHistoryEntry[],
  outcomes: readonly AlertOutcomeRecord[],
): RuleTypeStats[] {
  const byId = new Map(outcomes.map((o) => [o.entryId, o]))
  const map = new Map<RuleType, RuleTypeStats>()
  for (const e of history) {
    const rec = byId.get(e.id)
    if (!rec) continue
    const rt = ruleTypeOf(e)
    const s = map.get(rt) ?? { ruleType: rt, fired: 0, actedOn: 0, precision: null, falsePositiveReasons: {} }
    s.fired++
    if (rec.outcome === 'acted_on') s.actedOn++
    else {
      const why = reasonFor(e, rec)
      s.falsePositiveReasons[why] = (s.falsePositiveReasons[why] ?? 0) + 1
    }
    map.set(rt, s)
  }
  return [...map.values()]
    .map((s) => ({ ...s, precision: s.fired ? s.actedOn / s.fired : null }))
    .sort((a, b) => a.ruleType.localeCompare(b.ruleType))
}

/** Suggestions need at least `minFires` outcomes and precision below `target`. */
export function suggestTuning(stats: readonly RuleTypeStats[], minFires = 5, target = 0.5): TuningSuggestion[] {
  const out: TuningSuggestion[] = []
  for (const s of stats) {
    if (s.fired < minFires || s.precision === null || s.precision >= target) continue
    const r = s.falsePositiveReasons
    const top = (Object.entries(r) as [FalsePositiveReason, number][]).sort((a, b) => b[1] - a[1])[0]?.[0]
    const pct = Math.round(s.precision * 100)
    if (top === 'too_close_to_price')
      out.push({ ruleType: s.ruleType, kind: 'threshold', message: `${s.ruleType}: precision ${pct}%; most false positives fire within 0.5% of the threshold. Move the threshold further from spot.` })
    else if (top === 'retrigger_noise')
      out.push({ ruleType: s.ruleType, kind: 'window', message: `${s.ruleType}: precision ${pct}%; alerts retrigger repeatedly. Lengthen the window or add a cooldown.` })
    else
      out.push({ ruleType: s.ruleType, kind: 'condition', message: `${s.ruleType}: precision ${pct}%; alerts are dismissed quickly. Tighten the condition (e.g. require confirmation).` })
  }
  return out
}
