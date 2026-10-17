/**
 * @file Dismissal state for inline explanations (#822).
 *
 * A user dismisses an explanation by id. Whether it shows again is decided by the
 * `explanationReappearPolicy` preference, measured from the dismissal time:
 *
 * - `never`: a dismissed explanation stays hidden.
 * - `weekly`: it reappears once seven days have passed since dismissal.
 * - `always`: dismissals are ignored.
 *
 * Only ids and timestamps are stored, under `STORAGE_KEYS.dismissedExplanations`.
 */
import type { ExplanationReappearPolicy } from '../preferences/types'
import { readJson, remove, STORAGE_KEYS, writeJson } from './storage'

export const WEEKLY_REAPPEAR_MS = 7 * 24 * 60 * 60 * 1000

/** Explanation id to the epoch-ms time it was dismissed. */
export type ExplanationDismissals = Record<string, number>

function isDismissals(value: unknown): value is ExplanationDismissals {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((t) => typeof t === 'number' && Number.isFinite(t))
}

export function loadExplanationDismissals(): ExplanationDismissals {
  return readJson<ExplanationDismissals>(STORAGE_KEYS.dismissedExplanations, {}, isDismissals)
}

/** Returns the dismissal map with `id` recorded at `now`. Does not persist. */
export function withDismissal(dismissals: ExplanationDismissals, id: string, now: number): ExplanationDismissals {
  return { ...dismissals, [id]: now }
}

export function saveExplanationDismissals(dismissals: ExplanationDismissals): boolean {
  return writeJson(STORAGE_KEYS.dismissedExplanations, dismissals)
}

/** Forgets every dismissal, so all explanations show again. */
export function resetExplanationDismissals(): void {
  remove(STORAGE_KEYS.dismissedExplanations)
}

/** Whether explanation `id` should be visible under `policy`. */
export function shouldShowExplanation(
  id: string,
  policy: ExplanationReappearPolicy,
  dismissals: ExplanationDismissals,
  now: number,
): boolean {
  const dismissedAt = dismissals[id]
  if (dismissedAt === undefined) return true
  if (policy === 'always') return true
  if (policy === 'never') return false
  return now - dismissedAt >= WEEKLY_REAPPEAR_MS
}
