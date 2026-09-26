import { describe, it, expect } from 'vitest'
import type { AlertHistoryEntry } from '../types'
import { computeRuleTypePrecision, suggestTuning, ruleTypeOf, type AlertOutcomeRecord } from './alertOutcomes'

const entry = (id: string, over: Partial<AlertHistoryEntry> = {}): AlertHistoryEntry => ({
  id, alertId: 'a', assetPair: 'BTC/USD', triggeredAt: 1, price: 100.1, triggerOnce: false, percentageMode: false,
  upperThreshold: 100, lowerThreshold: null, percentageThreshold: null, percentageWindow: null, percentageDirection: null, ...over,
})

describe('alert outcomes', () => {
  const history = ['1', '2', '3', '4', '5', '6'].map((i) => entry(i))
  const outcomes: AlertOutcomeRecord[] = history.map((h, i) => ({ entryId: h.id, outcome: i === 0 ? 'acted_on' : 'dismissed' }))
  it('computes precision per rule type with reasons', () => {
    const [s] = computeRuleTypePrecision(history, outcomes)
    expect(s.ruleType).toBe('threshold_upper')
    expect(s.precision).toBeCloseTo(1 / 6)
    expect(s.falsePositiveReasons.too_close_to_price).toBe(5)
  })
  it('produces a concrete suggestion', () => {
    const sug = suggestTuning(computeRuleTypePrecision(history, outcomes))
    expect(sug).toHaveLength(1)
    expect(sug[0].kind).toBe('threshold')
  })
  it('classifies rule types', () => {
    expect(ruleTypeOf(entry('x', { percentageMode: true }))).toBe('percentage')
    expect(ruleTypeOf(entry('x', { upperThreshold: null, lowerThreshold: 5 }))).toBe('threshold_lower')
  })
})
