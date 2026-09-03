import { describe, expect, it } from 'vitest'
import { computeDivergence } from './divergence'

describe('computeDivergence', () => {
  it('reports in-sync when prices match exactly', () => {
    const d = computeDivergence(100, 100, 1)
    expect(d.absoluteDelta).toBe(0)
    expect(d.percentageDelta).toBe(0)
    expect(d.status).toBe('in-sync')
  })

  it('reports in-sync below half the threshold', () => {
    const d = computeDivergence(100.2, 100, 1)
    expect(d.percentageDelta).toBeCloseTo(0.2, 5)
    expect(d.status).toBe('in-sync')
  })

  it('reports warning between half and a full threshold', () => {
    const d = computeDivergence(100.6, 100, 1)
    expect(d.status).toBe('warning')
  })

  it('reports breached at or above the threshold', () => {
    const d = computeDivergence(101.5, 100, 1)
    expect(d.percentageDelta).toBeCloseTo(1.5, 5)
    expect(d.status).toBe('breached')
  })

  it('is symmetric for negative divergence (on-chain higher than off-chain)', () => {
    const d = computeDivergence(98, 100, 1)
    expect(d.percentageDelta).toBeCloseTo(-2, 5)
    expect(d.status).toBe('breached')
  })

  it('treats a zero on-chain price as full divergence instead of dividing by zero', () => {
    const d = computeDivergence(50, 0, 1)
    expect(Number.isFinite(d.percentageDelta)).toBe(true)
    expect(d.status).toBe('breached')
  })

  it('treats both prices being zero as in-sync', () => {
    const d = computeDivergence(0, 0, 1)
    expect(d.percentageDelta).toBe(0)
    expect(d.status).toBe('in-sync')
  })
})
