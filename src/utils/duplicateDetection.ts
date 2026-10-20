import type { CommunitySurface, ModerationReport, ReportCategory } from './moderation'

export interface DraftReportInput {
  surface: CommunitySurface
  targetId: string
  category: ReportCategory
  evidence: string
}

export interface DuplicateMatch {
  report: ModerationReport
  score: number
  confidence: 'high' | 'medium'
  matchedOn: Array<'target' | 'surface' | 'category' | 'evidence'>
}

export interface DuplicateDetectionOptions {
  /** Minimum similarity score to be considered a duplicate. Default is 0.52. */
  threshold?: number
  /** Maximum number of duplicate matches to return. Default is 3. */
  maxResults?: number
  /** Lookback window in milliseconds for considering reports. Default is 7 days. */
  lookbackMs?: number
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
])

/**
 * Tokenizes text into lowercase alphanumeric words, filtering out common stop words.
 */
export function tokenizeText(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

  return new Set(words)
}

/**
 * Computes Jaccard similarity between two sets of tokens.
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Detects likely duplicate community reports before submission (#860).
 * Compares draft surface, target, category, and tokenized evidence text
 * against existing reports.
 */
export function findDuplicateReports(
  draft: DraftReportInput,
  existingReports: readonly ModerationReport[],
  options: DuplicateDetectionOptions = {},
): DuplicateMatch[] {
  const { threshold = 0.52, maxResults = 3, lookbackMs = 7 * 24 * 3600 * 1000 } = options

  const cleanEvidence = draft.evidence.trim()
  // Require minimum evidence length before running fuzzy matching to avoid noisy typing alerts
  if (cleanEvidence.length < 8) return []

  const draftTokens = tokenizeText(cleanEvidence)
  const normalizedTarget = draft.targetId.trim().toLowerCase()
  const now = Date.now()
  const cutoff = now - lookbackMs

  const matches: DuplicateMatch[] = []

  for (const report of existingReports) {
    // Only compare against recent reports
    if (report.createdAt < cutoff) continue

    const reportTarget = report.targetId.trim().toLowerCase()
    const targetMatch = Boolean(normalizedTarget && reportTarget === normalizedTarget)
    const surfaceMatch = report.surface === draft.surface
    const categoryMatch = report.category === draft.category

    const reportTokens = tokenizeText(report.evidence)
    const textSimilarity = jaccardSimilarity(draftTokens, reportTokens)

    const matchedOn: Array<'target' | 'surface' | 'category' | 'evidence'> = []
    let score = 0

    if (targetMatch) {
      score += 0.38
      matchedOn.push('target')
    }
    if (surfaceMatch) {
      score += 0.15
      matchedOn.push('surface')
    }
    if (categoryMatch) {
      score += 0.15
      matchedOn.push('category')
    }

    if (textSimilarity > 0.15) {
      score += Math.min(textSimilarity * 0.45, 0.45)
      matchedOn.push('evidence')
    }

    // High confidence if both target and text are strong matches, or exact target + category + some text
    if (score >= threshold) {
      const confidence = score >= 0.72 ? 'high' : 'medium'
      matches.push({
        report,
        score: Math.min(score, 1),
        confidence,
        matchedOn,
      })
    }
  }

  // Sort descending by similarity score
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, maxResults)
}
