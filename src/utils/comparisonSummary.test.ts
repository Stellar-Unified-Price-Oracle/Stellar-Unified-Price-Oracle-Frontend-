import { describe, it, expect } from 'vitest'
import type { PriceHistoryEntry } from '../types'
import { summarizePairRange, summarizeSelection } from './comparisonSummary'

function point(timestamp: number, price: number): PriceHistoryEntry {
  return { timestamp, price, confidence: 0.99, sources: ['chainlink'] }
}

const series: PriceHistoryEntry[] = [point(3000, 110), point(1000, 100), point(2000, 90), point(4000, 120)]

describe('summarizePairRange', () => {
  it('summarises the whole series when no window is given, regardless of input order', () => {
    const s = summarizePairRange('BTC/USD', series)
    expect(s.points).toBe(4)
    expect(s.from).toBe(1000)
    expect(s.to).toBe(4000)
    expect(s.firstPrice).toBe(100)
    expect(s.lastPrice).toBe(120)
    expect(s.changePercent).toBeCloseTo(20, 10)
    expect(s.low).toBe(90)
    expect(s.high).toBe(120)
  })

  it('limits the summary to the window, inclusive at both ends', () => {
    const s = summarizePairRange('BTC/USD', series, 2000, 3000)
    expect(s.points).toBe(2)
    expect(s.firstPrice).toBe(90)
    expect(s.lastPrice).toBe(110)
    expect(s.changePercent).toBeCloseTo((110 / 90 - 1) * 100, 10)
  })

  it('reports no data rather than a change when the window is empty', () => {
    const s = summarizePairRange('XLM/USD', series, 5000, 6000)
    expect(s.points).toBe(0)
    expect(s.from).toBeNull()
    expect(s.changePercent).toBeNull()
    expect(s.low).toBeNull()
  })

  it('leaves change undefined when the first price is zero', () => {
    const s = summarizePairRange('X', [point(1, 0), point(2, 5)])
    expect(s.changePercent).toBeNull()
    expect(s.points).toBe(2)
  })

  it('ignores non-finite prices', () => {
    const s = summarizePairRange('X', [point(1, Number.NaN), point(2, 7)])
    expect(s.points).toBe(1)
    expect(s.firstPrice).toBe(7)
  })
})

describe('summarizeSelection', () => {
  it('returns one row per selected pair in order, including pairs with no history', () => {
    const rows = summarizeSelection(['ETH/USD', 'BTC/USD'], { 'BTC/USD': series })
    expect(rows.map((r) => r.pair)).toEqual(['ETH/USD', 'BTC/USD'])
    expect(rows[0].points).toBe(0)
    expect(rows[1].points).toBe(4)
  })
})
