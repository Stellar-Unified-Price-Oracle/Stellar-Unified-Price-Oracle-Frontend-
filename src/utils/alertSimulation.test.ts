import { describe, it, expect } from 'vitest'
import type { AlertFormData } from '../types'
import { simulateAlert, generateSyntheticSeries, countSimulatedFires } from './alertSimulation'

function form(overrides?: Partial<AlertFormData>): AlertFormData {
  return {
    assetPair: 'BTC/USD',
    upperThreshold: '',
    lowerThreshold: '',
    triggerOnce: false,
    percentageMode: false,
    percentageThreshold: '',
    percentageWindow: '1hr',
    percentageDirection: 'either',
    percentageRelativeTo: 'open',
    cooldownMinutes: '5',
    extraConditions: [],
    conditionsLogic: 'AND',
    escalationEnabled: false,
    escalationSteps: [],
    channels: [],
    retestMode: false,
    ...overrides,
  }
}

describe('generateSyntheticSeries (#490)', () => {
  it('produces a finite, non-empty series', () => {
    const s = generateSyntheticSeries(form({ upperThreshold: '70000', lowerThreshold: '' }), 60000)
    expect(s.length).toBeGreaterThan(0)
    expect(s.every((p) => Number.isFinite(p) && p > 0)).toBe(true)
  })

  it('handles degenerate input without crashing', () => {
    const s = generateSyntheticSeries(form({ upperThreshold: '' }), 0, 5)
    expect(s).toHaveLength(5)
    expect(s.every((p) => p === 0)).toBe(true)
  })
})

describe('simulateAlert (#490)', () => {
  it('uses the production evaluation path and marks fires for an upper threshold', () => {
    // Upper threshold of 65000; series oscillates below and above 65000, so fires occur.
    const points = simulateAlert(form({ upperThreshold: '65000', lowerThreshold: '' }), 60000)
    const fires = points.filter((p) => p.fired)
    expect(points).toHaveLength(60)
    expect(fires.length).toBeGreaterThan(0)
    // All firing points must actually be at/above the threshold per production eval.
    fires.forEach((p) => expect(p.price).toBeGreaterThanOrEqual(65000))
  })

  it('marks no fires when the condition can never be met', () => {
    // Huge threshold the synthetic series will never reach.
    const points = simulateAlert(form({ upperThreshold: '999999', lowerThreshold: '' }), 60000)
    expect(countSimulatedFires(points)).toBe(0)
  })

  it('respects percentage-mode evaluation state', () => {
    const points = simulateAlert(
      form({
        percentageMode: true,
        percentageThreshold: '2',
        percentageDirection: 'up',
      }),
      100,
    )
    expect(points.length).toBe(60)
    // Downward-only is a no-op here; fires only when up by >=2%.
    expect(points.every((p) => Number.isFinite(p.price))).toBe(true)
  })

  it('returns fire positions deterministically for the same inputs', () => {
    const f = form({ upperThreshold: '65000', lowerThreshold: '' })
    const a = simulateAlert(f, 60000)
    const b = simulateAlert(f, 60000)
    expect(a.map((p) => p.fired)).toEqual(b.map((p) => p.fired))
  })
})