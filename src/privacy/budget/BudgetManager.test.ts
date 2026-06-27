import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetManager, DEFAULT_CONFIG } from './BudgetManager'

// jsdom provides localStorage; reset between tests
beforeEach(() => {
  localStorage.clear()
})

describe('BudgetManager', () => {
  it('starts with full budget', () => {
    const bm = new BudgetManager()
    const state = bm.getState()
    expect(state.spentToday).toBe(0)
    expect(state.remaining).toBeCloseTo(DEFAULT_CONFIG.dailyEpsilon)
    expect(state.optedOut).toBe(false)
  })

  it('consumes epsilon on record', () => {
    const bm = new BudgetManager()
    const ok = bm.consume('navigation')
    expect(ok).toBe(true)
    expect(bm.getState().spentToday).toBeCloseTo(DEFAULT_CONFIG.epsilonPerCategory.navigation)
    expect(bm.getState().remaining).toBeCloseTo(
      DEFAULT_CONFIG.dailyEpsilon - DEFAULT_CONFIG.epsilonPerCategory.navigation,
    )
  })

  it('returns false when budget exhausted', () => {
    const bm = new BudgetManager({ ...DEFAULT_CONFIG, dailyEpsilon: 0.05 })
    // First export consumes 0.05; budget hits 0
    const first = bm.consume('export')
    expect(first).toBe(false) // export costs 0.2 > 0.05, so immediately exhausted
  })

  it('returns false when opted out', () => {
    const bm = new BudgetManager()
    bm.setOptOut(true)
    expect(bm.consume('navigation')).toBe(false)
  })

  it('opt-out persists via localStorage', () => {
    const bm = new BudgetManager()
    bm.setOptOut(true)
    const bm2 = new BudgetManager()
    expect(bm2.isOptedOut()).toBe(true)
  })

  it('reset restores full budget', () => {
    const bm = new BudgetManager()
    bm.consume('navigation')
    bm.reset()
    expect(bm.getState().spentToday).toBe(0)
    expect(bm.getState().remaining).toBeCloseTo(DEFAULT_CONFIG.dailyEpsilon)
  })

  it('tracks per-category spend', () => {
    const bm = new BudgetManager()
    bm.consume('navigation')
    bm.consume('navigation')
    const state = bm.getState()
    expect(state.spentPerCategory.navigation).toBeCloseTo(
      DEFAULT_CONFIG.epsilonPerCategory.navigation * 2,
    )
    expect(state.spentPerCategory.search).toBe(0)
  })
})
