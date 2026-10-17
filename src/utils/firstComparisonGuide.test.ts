import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPARISON_GUIDE,
  getComparisonGuideSteps,
  isComparisonGuideComplete,
  readComparisonGuide,
  saveComparisonGuide,
} from './firstComparisonGuide'
import { STORAGE_KEYS, writeJson } from './storage'

describe('firstComparisonGuide storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the default progress when nothing is stored', () => {
    expect(readComparisonGuide()).toEqual(DEFAULT_COMPARISON_GUIDE)
  })

  it('round-trips saved progress', () => {
    const progress = { viewedPair: true, comparedPairs: false, dismissed: true }
    saveComparisonGuide(progress)
    expect(readComparisonGuide()).toEqual(progress)
  })

  it('discards malformed stored values in favour of the default', () => {
    writeJson(STORAGE_KEYS.firstComparisonGuide, { viewedPair: 'yes', comparedPairs: true })
    expect(readComparisonGuide()).toEqual(DEFAULT_COMPARISON_GUIDE)
  })
})

describe('getComparisonGuideSteps', () => {
  it('lists the checkpoints in order with completion taken from progress', () => {
    const steps = getComparisonGuideSteps({ viewedPair: true, comparedPairs: false, dismissed: false })
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ['viewedPair', true],
      ['comparedPairs', false],
    ])
  })
})

describe('isComparisonGuideComplete', () => {
  it('requires both checkpoints; the dismissed flag alone does not complete it', () => {
    expect(isComparisonGuideComplete({ viewedPair: true, comparedPairs: false, dismissed: false })).toBe(false)
    expect(isComparisonGuideComplete({ viewedPair: false, comparedPairs: true, dismissed: true })).toBe(false)
    expect(isComparisonGuideComplete({ viewedPair: true, comparedPairs: true, dismissed: false })).toBe(true)
  })
})
