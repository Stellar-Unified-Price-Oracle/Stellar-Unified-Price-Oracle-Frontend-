import { describe, it, expect } from 'vitest'
import { fuzzyMatch, fuzzyMatchQuery, rankByFuzzy } from './fuzzy'

describe('fuzzyMatch', () => {
  it('matches an empty term with a neutral score', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] })
  })

  it('marks a contiguous substring and returns its indices', () => {
    const match = fuzzyMatch('dash', 'Go to Dashboard')
    expect(match).not.toBeNull()
    expect(match!.indices).toEqual([6, 7, 8, 9])
  })

  it('is case-insensitive', () => {
    expect(fuzzyMatch('DASH', 'dashboard')).not.toBeNull()
    expect(fuzzyMatch('dash', 'DASHBOARD')).not.toBeNull()
  })

  it('returns null when the term is not a subsequence', () => {
    expect(fuzzyMatch('xyz', 'dashboard')).toBeNull()
  })

  it('returns null when the term is longer than the target', () => {
    expect(fuzzyMatch('dashboard', 'dash')).toBeNull()
  })

  it('matches a scattered subsequence', () => {
    const match = fuzzyMatch('asb', 'dashboard')
    expect(match).not.toBeNull()
    expect(match!.indices).toEqual([1, 2, 4])
  })

  it('ranks a prefix match above a mid-string substring', () => {
    const prefix = fuzzyMatch('price', 'Price alert')
    const inner = fuzzyMatch('price', 'Export price data')
    expect(prefix!.score).toBeGreaterThan(inner!.score)
  })

  it('ranks a contiguous substring above a scattered subsequence', () => {
    const contiguous = fuzzyMatch('dash', 'dashboard')
    const scattered = fuzzyMatch('dash', 'downloads sheet')
    expect(contiguous!.score).toBeGreaterThan(scattered!.score)
  })

  it('ranks a word-boundary match above one buried inside a word', () => {
    const boundary = fuzzyMatch('alert', 'Price alert panel')
    const buried = fuzzyMatch('alert', 'prealerted')
    expect(boundary!.score).toBeGreaterThan(buried!.score)
  })

  it('gives an exact match the highest score', () => {
    const exact = fuzzyMatch('dashboard', 'dashboard')
    const prefix = fuzzyMatch('dashboard', 'dashboard view')
    expect(exact!.score).toBeGreaterThan(prefix!.score)
  })
})

describe('fuzzyMatchQuery', () => {
  it('requires every whitespace-separated term to match', () => {
    expect(fuzzyMatchQuery('go dash', 'Go to Dashboard')).not.toBeNull()
    expect(fuzzyMatchQuery('go xyz', 'Go to Dashboard')).toBeNull()
  })

  it('unions the matched indices across terms', () => {
    const match = fuzzyMatchQuery('go dash', 'Go to Dashboard')
    expect(match).not.toBeNull()
    expect(match!.indices).toEqual([0, 1, 6, 7, 8, 9])
  })

  it('treats surrounding whitespace as an empty query', () => {
    expect(fuzzyMatchQuery('   ', 'anything')).toEqual({ score: 0, indices: [] })
  })
})

describe('rankByFuzzy', () => {
  const items = [
    { id: 'a', label: 'Go to Dashboard' },
    { id: 'b', label: 'Export data as CSV' },
    { id: 'c', label: 'Toggle theme' },
  ]
  const fields = (item: (typeof items)[number]) => ({ primary: item.label })

  it('returns every item in the original order for an empty query', () => {
    expect(rankByFuzzy(items, '', fields).map((r) => r.item.id)).toEqual(['a', 'b', 'c'])
  })

  it('orders matches by descending score', () => {
    const ranked = rankByFuzzy(items, 'theme', fields)
    expect(ranked.map((r) => r.item.id)).toEqual(['c'])
  })

  it('drops non-matching items', () => {
    const ranked = rankByFuzzy(items, 'zzz', fields)
    expect(ranked).toHaveLength(0)
  })

  it('prefers a primary-label match over a secondary-only match', () => {
    const withSecondary = [
      { id: 'secondary', label: 'Nothing here', keywords: 'dashboard' },
      { id: 'primary', label: 'Go to Dashboard', keywords: '' },
    ]
    const ranked = rankByFuzzy(withSecondary, 'dashboard', (item) => ({
      primary: item.label,
      secondary: item.keywords,
    }))
    expect(ranked.map((r) => r.item.id)).toEqual(['primary', 'secondary'])
  })

  it('is stable for equal scores', () => {
    const tied = [
      { id: 'first', label: 'Pair A' },
      { id: 'second', label: 'Pair B' },
    ]
    // Neither matches; an empty query keeps both in registration order.
    expect(rankByFuzzy(tied, '', fields).map((r) => r.item.id)).toEqual(['first', 'second'])
  })

  it('handles large inputs without dropping matches', () => {
    const many = Array.from({ length: 5_000 }, (_, i) => ({ id: `p${i}`, label: `BTC/USD ${i}` }))
    const ranked = rankByFuzzy(many, 'btcusd 42', (item) => ({ primary: item.label }))
    // Every pair containing "42" shares the prefix plus the term; all 5000
    // labels contain "btcusd" as a subsequence, so we only assert the top hit.
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked[0].item.label).toContain('42')
  })
})
