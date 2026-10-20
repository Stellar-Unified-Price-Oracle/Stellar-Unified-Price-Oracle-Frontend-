import { describe, it, expect } from 'vitest'
import {
  findDuplicateReports,
  jaccardSimilarity,
  tokenizeText,
} from './duplicateDetection'
import type { ModerationReport } from './moderation'

function makeMockReport(
  id: string,
  targetId: string,
  category: 'spam' | 'data-quality' | 'misinformation' = 'data-quality',
  evidence: string = 'Abnormal 10% price spike on XLM feed',
  surface: 'chart' | 'governance' | 'feedback' = 'chart',
  createdAt: number = Date.now() - 3600_000,
): ModerationReport {
  return {
    id,
    surface,
    targetId,
    category,
    evidence,
    confidential: false,
    stage: 'triage',
    decision: null,
    rationale: null,
    history: [{ stage: 'triage', at: createdAt }],
    createdAt,
  }
}

describe('duplicateDetection', () => {
  describe('tokenizeText', () => {
    it('lowercases and extracts alphanumeric tokens while removing common stop words', () => {
      const tokens = tokenizeText('The price on Binance is reporting a major spike!')
      expect(tokens.has('the')).toBe(false)
      expect(tokens.has('is')).toBe(false)
      expect(tokens.has('price')).toBe(true)
      expect(tokens.has('binance')).toBe(true)
      expect(tokens.has('spike')).toBe(true)
    })

    it('handles punctuation and special characters gracefully', () => {
      const tokens = tokenizeText('BTC/USD: $64,250.00 -> $72,000.00 (deviation > 12%)')
      expect(tokens.has('btc')).toBe(true)
      expect(tokens.has('usd')).toBe(true)
      expect(tokens.has('deviation')).toBe(true)
    })
  })

  describe('jaccardSimilarity', () => {
    it('returns 1 for identical token sets', () => {
      const setA = new Set(['binance', 'spike', 'outlier'])
      const setB = new Set(['binance', 'spike', 'outlier'])
      expect(jaccardSimilarity(setA, setB)).toBe(1)
    })

    it('returns 0 for disjoint token sets', () => {
      const setA = new Set(['binance', 'spike'])
      const setB = new Set(['kraken', 'latency'])
      expect(jaccardSimilarity(setA, setB)).toBe(0)
    })

    it('computes intersection over union correctly', () => {
      const setA = new Set(['a', 'b', 'c'])
      const setB = new Set(['b', 'c', 'd'])
      // intersection = 2 ('b', 'c'), union = 4 ('a', 'b', 'c', 'd') => 0.5
      expect(jaccardSimilarity(setA, setB)).toBe(0.5)
    })
  })

  describe('findDuplicateReports', () => {
    const existing = [
      makeMockReport(
        'rep-1',
        'XLM/USD',
        'data-quality',
        'Observed a 15% flash spike on Binance oracle contributor not present on Coinbase.',
        'chart',
        Date.now() - 7200_000,
      ),
      makeMockReport(
        'rep-2',
        'BTC/USD',
        'misinformation',
        'Proposal contains completely false APR estimates and fraudulent team links.',
        'governance',
        Date.now() - 3600_000,
      ),
    ]

    it('returns empty array when draft text is shorter than 8 characters', () => {
      const matches = findDuplicateReports(
        {
          surface: 'chart',
          targetId: 'XLM/USD',
          category: 'data-quality',
          evidence: 'spike',
        },
        existing,
      )
      expect(matches).toEqual([])
    })

    it('detects duplicate when target, category, surface, and evidence overlap closely', () => {
      const matches = findDuplicateReports(
        {
          surface: 'chart',
          targetId: 'XLM/USD',
          category: 'data-quality',
          evidence: 'There is a huge flash spike on the Binance contributor feed compared to Coinbase.',
        },
        existing,
      )

      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0].report.id).toBe('rep-1')
      expect(matches[0].confidence).toBe('high')
      expect(matches[0].matchedOn).toContain('target')
      expect(matches[0].matchedOn).toContain('evidence')
    })

    it('does not flag reports on completely different targets with distinct text', () => {
      const matches = findDuplicateReports(
        {
          surface: 'chart',
          targetId: 'ETH/USD',
          category: 'data-quality',
          evidence: 'Missing timestamps between 14:00 and 15:00 UTC on Kraken.',
        },
        existing,
      )

      expect(matches).toEqual([])
    })

    it('respects lookbackMs window and ignores stale expired reports', () => {
      const staleReport = makeMockReport(
        'rep-old',
        'XLM/USD',
        'data-quality',
        'Identical flash spike on Binance contributor.',
        'chart',
        Date.now() - 30 * 24 * 3600 * 1000, // 30 days ago
      )

      const matches = findDuplicateReports(
        {
          surface: 'chart',
          targetId: 'XLM/USD',
          category: 'data-quality',
          evidence: 'Identical flash spike on Binance contributor.',
        },
        [staleReport],
        { lookbackMs: 7 * 24 * 3600 * 1000 },
      )

      expect(matches).toEqual([])
    })
  })
})
