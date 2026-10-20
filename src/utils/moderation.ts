/**
 * Community moderation workflow (#699).
 *
 * Reports move triage → decided → actioned → notified. Every transition is
 * recorded with a timestamp so decisions are auditable, while reporter identity
 * is never captured — reports carry only the category, target, and evidence.
 */

import { z } from 'zod'
import { readJson, writeJson, STORAGE_KEYS } from './storage'

export const CODE_OF_CONDUCT_URL =
  'https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/blob/main/CONTRIBUTING.md#code-of-conduct'

export const REPORT_CATEGORIES = [
  'spam',
  'harassment',
  'hate',
  'misinformation',
  'off-topic',
  'data-quality',
  'other',
] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const COMMUNITY_SURFACES = ['feedback', 'translation', 'leaderboard', 'governance', 'chart'] as const
export type CommunitySurface = (typeof COMMUNITY_SURFACES)[number]

export const MODERATION_STAGES = ['triage', 'decided', 'actioned', 'notified'] as const
export type ModerationStage = (typeof MODERATION_STAGES)[number]

export const DECISIONS = ['no-violation', 'warning', 'content-removed', 'temporary-ban', 'permanent-ban'] as const
export type ModerationDecision = (typeof DECISIONS)[number]

const reportSchema = z.object({
  id: z.string(),
  surface: z.enum(COMMUNITY_SURFACES),
  targetId: z.string().max(200),
  category: z.enum(REPORT_CATEGORIES),
  evidence: z.string().max(2000),
  confidential: z.boolean(),
  stage: z.enum(MODERATION_STAGES),
  decision: z.enum(DECISIONS).nullable(),
  rationale: z.string().max(2000).nullable(),
  history: z.array(z.object({ stage: z.enum(MODERATION_STAGES), at: z.number() })),
  createdAt: z.number(),
})

export type ModerationReport = z.infer<typeof reportSchema>

const reportsSchema = z.array(reportSchema)

export function loadReports(): ModerationReport[] {
  return readJson(
    STORAGE_KEYS.moderationReports,
    [],
    (v): v is ModerationReport[] => reportsSchema.safeParse(v).success,
  )
}

export function saveReports(reports: ModerationReport[]): boolean {
  return writeJson(STORAGE_KEYS.moderationReports, reports)
}

export interface NewReport {
  surface: CommunitySurface
  targetId: string
  category: ReportCategory
  evidence: string
  confidential: boolean
}

export function createReport(input: NewReport, now: number = Date.now()): ModerationReport {
  return {
    id: `rpt-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    evidence: input.evidence.trim().slice(0, 2000),
    stage: 'triage',
    decision: null,
    rationale: null,
    history: [{ stage: 'triage', at: now }],
    createdAt: now,
  }
}

/** Next stage in the workflow, or null once the reporter has been notified. */
export function nextStage(stage: ModerationStage): ModerationStage | null {
  const i = MODERATION_STAGES.indexOf(stage)
  return i < MODERATION_STAGES.length - 1 ? MODERATION_STAGES[i + 1] : null
}

/** Records a decision; only valid from triage. */
export function decideReport(
  report: ModerationReport,
  decision: ModerationDecision,
  rationale: string,
  now: number = Date.now(),
): ModerationReport {
  if (report.stage !== 'triage') throw new Error(`Cannot decide a report in stage "${report.stage}"`)
  return {
    ...report,
    stage: 'decided',
    decision,
    rationale: rationale.trim().slice(0, 2000),
    history: [...report.history, { stage: 'decided', at: now }],
  }
}

/** Advances a decided report through action → notify. */
export function advanceReport(report: ModerationReport, now: number = Date.now()): ModerationReport {
  if (report.stage === 'triage') throw new Error('A decision must be recorded before advancing')
  const stage = nextStage(report.stage)
  if (!stage) return report
  return { ...report, stage, history: [...report.history, { stage, at: now }] }
}

export interface ModerationStats {
  total: number
  byCategory: Record<ReportCategory, number>
  byStage: Record<ModerationStage, number>
  byDecision: Record<ModerationDecision, number>
  /** Median ms from report to decision, or null with no decided reports. */
  medianTimeToDecisionMs: number | null
}

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
}

/**
 * Anonymized aggregate statistics safe to publish: counts only, no ids,
 * targets, evidence, or rationale text.
 */
export function moderationStats(reports: readonly ModerationReport[]): ModerationStats {
  const byCategory = zeroed(REPORT_CATEGORIES)
  const byStage = zeroed(MODERATION_STAGES)
  const byDecision = zeroed(DECISIONS)
  const durations: number[] = []
  for (const r of reports) {
    byCategory[r.category]++
    byStage[r.stage]++
    if (r.decision) byDecision[r.decision]++
    const decided = r.history.find((h) => h.stage === 'decided')
    if (decided) durations.push(decided.at - r.createdAt)
  }
  durations.sort((a, b) => a - b)
  const mid = Math.floor(durations.length / 2)
  const median =
    durations.length === 0 ? null : durations.length % 2 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2
  return { total: reports.length, byCategory, byStage, byDecision, medianTimeToDecisionMs: median }
}
