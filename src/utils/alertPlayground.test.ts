import { describe, it, expect } from 'vitest'
import type { AlertFormData } from '../types'
import { runAlertPlayground } from './alertPlayground'

const form = { assetPair: 'BTC/USD', upperThreshold: '100', lowerThreshold: '', percentageMode: false, percentageWindow: '1hr', extraConditions: [], conditionsLogic: 'AND' } as unknown as AlertFormData
const ticks = [90, 95, 101, 102, 99, 103].map((price, i) => ({ timestamp: i * 1000, price }))

describe('runAlertPlayground', () => {
  it('counts fires and breached time, flagged as dry run', () => {
    const r = runAlertPlayground(form, ticks)
    expect(r.dryRun).toBe(true)
    expect(r.fireCount).toBe(2)
    expect(r.timeInBreachedMs).toBe(1000)
  })
  it('is deterministic for a seed', () => {
    const big = Array.from({ length: 500 }, (_, i) => ({ timestamp: i, price: 90 + (i % 20) }))
    const a = runAlertPlayground(form, big, { seed: 7, maxPoints: 50 })
    expect(runAlertPlayground(form, big, { seed: 7, maxPoints: 50 })).toEqual(a)
  })
})
