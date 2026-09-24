import { describe, it, expect } from 'vitest'
import { estimatePoints, planQuery } from './planner'
import { DAY_MS, HOUR_MS } from './rollup'

const FROM = 1_000_000_000_000

describe('planQuery', () => {
  it('uses raw for short windows', () => {
    expect(planQuery({ series: 's', from: FROM, to: FROM + HOUR_MS }).tier).toBe('raw')
  })

  it('uses hourly for multi-hour windows', () => {
    expect(planQuery({ series: 's', from: FROM, to: FROM + DAY_MS }).tier).toBe('hourly')
  })

  it('uses daily for long windows', () => {
    expect(planQuery({ series: 's', from: FROM, to: FROM + 90 * DAY_MS }).tier).toBe('daily')
  })

  it('honours an explicit tier', () => {
    expect(planQuery({ series: 's', from: FROM, to: FROM + 90 * DAY_MS, tier: 'raw' }).tier).toBe('raw')
  })

  it('coarsens to respect a point budget', () => {
    const plan = planQuery({ series: 's', from: FROM, to: FROM + 20 * DAY_MS, maxPoints: 100 })
    expect(plan.tier).toBe('daily')
    expect(plan.estimatedPoints).toBeLessThanOrEqual(100)
  })

  it('falls back to the coarsest tier when even it exceeds the budget', () => {
    const plan = planQuery({ series: 's', from: FROM, to: FROM + 365 * DAY_MS, maxPoints: 50 })
    expect(plan.tier).toBe('daily')
  })

  it('normalises an inverted range', () => {
    const plan = planQuery({ series: 's', from: FROM + HOUR_MS, to: FROM })
    expect(plan.from).toBe(FROM)
    expect(plan.to).toBe(FROM + HOUR_MS)
  })

  it('always reports at least one estimated point', () => {
    expect(planQuery({ series: 's', from: FROM, to: FROM }).estimatedPoints).toBe(1)
  })
})

describe('estimatePoints', () => {
  it('scales with the tier bucket width', () => {
    expect(estimatePoints('daily', 10 * DAY_MS)).toBe(10)
    expect(estimatePoints('hourly', 10 * HOUR_MS)).toBe(10)
  })
})
