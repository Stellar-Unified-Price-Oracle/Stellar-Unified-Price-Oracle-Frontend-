import { describe, it, expect } from 'vitest'
import { buildCorpus, evaluate, CHOSEN_THRESHOLDS, REGRESSION_BOUND } from './anomalyEval'

describe('anomaly evaluation harness', () => {
  it('corpus is deterministic', () => {
    expect(buildCorpus()).toEqual(buildCorpus())
    expect(buildCorpus(1)).not.toEqual(buildCorpus(2))
  })

  it('reports precision/recall/F1 and time-to-detect', () => {
    const s = evaluate(buildCorpus(), CHOSEN_THRESHOLDS)
    expect(s.tp + s.fn).toBe(8)
    expect(s.meanTimeToDetectTicks).not.toBeNull()
    expect(s.f1).toBeGreaterThan(0)
  })

  it('CI gate: chosen thresholds stay within the documented bound', () => {
    const s = evaluate(buildCorpus(), CHOSEN_THRESHOLDS)
    expect(s.precision).toBeGreaterThanOrEqual(REGRESSION_BOUND.minPrecision)
    expect(s.recall).toBeGreaterThanOrEqual(REGRESSION_BOUND.minRecall)
    expect(s.f1).toBeGreaterThanOrEqual(REGRESSION_BOUND.minF1)
  })

  it('a loosened threshold set is detected as a regression', () => {
    const s = evaluate(buildCorpus(), { ...CHOSEN_THRESHOLDS, gapThresholdPercent: 50, zScoreThreshold: 50 })
    expect(s.recall).toBeLessThan(REGRESSION_BOUND.minRecall)
  })
})
