/**
 * Fuzzy matching for the command palette.
 *
 * Kept dependency-free and pure so ranking can be unit tested without a DOM.
 *
 * Two levels:
 *  - {@link fuzzyMatch} scores a single whitespace-free term against a target.
 *  - {@link fuzzyMatchQuery} splits a raw query on whitespace and requires every
 *    term to match (AND semantics), like fzf.
 *
 * Matching prefers, in order: an exact match, a prefix match, a word-boundary
 * match, then a scattered subsequence. Returned `indices` point at the matched
 * characters so the palette can highlight them.
 */

export interface FuzzyMatch {
  score: number
  indices: number[]
}

/** Characters that, when they precede a match, count as a word boundary. */
const BOUNDARY_CHARS = new Set([' ', '-', '_', '/', '.', ':', '>', '('])

/** Upper bound on how many start positions are explored for a subsequence. */
const MAX_START_POSITIONS = 64

/** Separates primary-label matches from secondary-only matches in the ranking. */
const PRIMARY_MATCH_BONUS = 10_000

function isBoundary(target: string, index: number): boolean {
  if (index === 0) return true
  return BOUNDARY_CHARS.has(target[index - 1])
}

/** Greedily matches `query` as a subsequence of `target` starting at `start`. */
function matchFrom(query: string, target: string, start: number): FuzzyMatch | null {
  const indices: number[] = []
  let qi = 0
  for (let ti = start; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      indices.push(ti)
      qi++
    }
  }
  if (qi < query.length) return null

  let score = 100
  let consecutive = 0
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    if (i > 0 && index === indices[i - 1] + 1) {
      consecutive++
      score += 14 + consecutive * 4
    } else {
      consecutive = 0
      if (i > 0) {
        score -= (index - indices[i - 1] - 1) * 2
      }
    }
    if (isBoundary(target, index)) score += 16
  }
  score -= indices[0] * 1.5
  return { score: Math.round(score), indices }
}

/**
 * Scores a single term (no spaces) against `target`. Returns `null` when the
 * term is not a subsequence of the target.
 */
export function fuzzyMatch(term: string, target: string): FuzzyMatch | null {
  const query = term.trim().toLowerCase()
  if (query.length === 0) return { score: 0, indices: [] }

  const lower = target.toLowerCase()
  if (query.length > lower.length) return null

  // Contiguous substring fast path — exact/prefix hits should dominate.
  const substringAt = lower.indexOf(query)
  if (substringAt !== -1) {
    let score = 1000
    if (substringAt === 0) score += 300
    if (isBoundary(lower, substringAt)) score += 150
    if (query === lower) score += 400
    score -= substringAt * 2

    const indices: number[] = []
    for (let i = 0; i < query.length; i++) indices.push(substringAt + i)
    return { score: Math.round(score), indices }
  }

  let best: FuzzyMatch | null = null
  let starts = 0
  for (let i = 0; i < lower.length && starts < MAX_START_POSITIONS; i++) {
    if (lower[i] !== query[0]) continue
    starts++
    const match = matchFrom(query, lower, i)
    if (match && (!best || match.score > best.score)) best = match
  }
  return best
}

/**
 * Scores a raw, possibly multi-word query. Every term must match the target
 * (AND semantics); the combined score is the sum of the per-term scores.
 */
export function fuzzyMatchQuery(query: string, target: string): FuzzyMatch | null {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return { score: 0, indices: [] }
  if (terms.length === 1) return fuzzyMatch(terms[0], target)

  let score = 0
  const indices = new Set<number>()
  for (const term of terms) {
    const match = fuzzyMatch(term, target)
    if (!match) return null
    score += match.score
    for (const index of match.indices) indices.add(index)
  }
  return { score, indices: [...indices].sort((a, b) => a - b) }
}

export interface RankedItem<T> {
  item: T
  score: number
  /** Matched character positions within the item's `primary` field. */
  indices: number[]
}

/**
 * Ranks `items` against `query`.
 *
 * `getFields` returns the `primary` text (usually the label) and an optional
 * `secondary` blob (hint, keywords, category). Any `primary` match outranks
 * every `secondary`-only match, so a label hit always beats a hit on incidental
 * metadata — even when the metadata is an exact match. With an empty query the
 * original order is preserved.
 */
export function rankByFuzzy<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => { primary: string; secondary?: string },
): RankedItem<T>[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return items.map((item) => ({ item, score: 0, indices: [] }))
  }

  const ranked: RankedItem<T>[] = []
  for (const item of items) {
    const { primary, secondary } = getFields(item)

    const primaryMatch = fuzzyMatchQuery(trimmed, primary)
    if (primaryMatch) {
      // The bonus is far larger than any achievable per-field score, so primary
      // matches are strictly ordered ahead of secondary-only matches.
      ranked.push({ item, score: primaryMatch.score + PRIMARY_MATCH_BONUS, indices: primaryMatch.indices })
      continue
    }

    if (secondary) {
      const secondaryMatch = fuzzyMatchQuery(trimmed, secondary)
      if (secondaryMatch) {
        ranked.push({ item, score: secondaryMatch.score, indices: [] })
      }
    }
  }

  // Array.prototype.sort is stable, so equal scores keep registration order.
  return ranked.sort((a, b) => b.score - a.score)
}
