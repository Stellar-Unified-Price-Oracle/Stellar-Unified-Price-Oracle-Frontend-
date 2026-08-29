import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMarketOverviewStats, isOverviewFilterKey } from './useMarketOverviewStats'
import type { PriceData } from '../types'

const NOW = 1_700_000_000_000

function price(overrides: Partial<PriceData>): PriceData {
  return {
    assetPair: 'BTC/USD',
    price: 100,
    timestamp: NOW,
    confidence: 0.9,
    sources: ['chainlink'],
    ...overrides,
  }
}

describe('isOverviewFilterKey', () => {
  it('accepts known keys and rejects everything else', () => {
    expect(isOverviewFilterKey('movers')).toBe(true)
    expect(isOverviewFilterKey('atHigh')).toBe(true)
    expect(isOverviewFilterKey('bogus')).toBe(false)
    expect(isOverviewFilterKey(null)).toBe(false)
  })
})

describe('useMarketOverviewStats', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty/null result for an empty price list', () => {
    const { result } = renderHook(() => useMarketOverviewStats([]))
    expect(result.current.changePct).toBeNull()
    expect(result.current.avgConfidence).toBeNull()
    expect(result.current.avgFreshnessMs).toBeNull()
    expect(result.current.pairsByFilter.movers).toEqual([])
  })

  it('computes avg confidence and avg freshness directly from the live list', () => {
    const prices = [
      price({ assetPair: 'BTC/USD', confidence: 1.0, timestamp: NOW }),
      price({ assetPair: 'ETH/USD', confidence: 0.5, timestamp: NOW - 10_000 }),
    ]
    const { result } = renderHook(() => useMarketOverviewStats(prices))
    expect(result.current.avgConfidence).toBeCloseTo(0.75)
    expect(result.current.avgFreshnessMs).toBeCloseTo(5_000)
    expect(result.current.highPrice).toBe(100)
    expect(result.current.lowPrice).toBe(100)
  })

  it('isolates the lowest-confidence pairs for the lowConfidence filter', () => {
    const prices = [
      price({ assetPair: 'BTC/USD', confidence: 0.99 }),
      price({ assetPair: 'ETH/USD', confidence: 0.2 }),
      price({ assetPair: 'XLM/USD', confidence: 0.95 }),
      price({ assetPair: 'ADA/USD', confidence: 0.9 }),
    ]
    const { result } = renderHook(() => useMarketOverviewStats(prices))
    expect(result.current.pairsByFilter.lowConfidence).toContain('ETH/USD')
    expect(result.current.pairsByFilter.lowConfidence).not.toContain('BTC/USD')
  })

  it('isolates the stalest pairs for the stale filter', () => {
    const prices = [
      price({ assetPair: 'BTC/USD', timestamp: NOW }),
      price({ assetPair: 'ETH/USD', timestamp: NOW - 5_000 }),
      price({ assetPair: 'XLM/USD', timestamp: NOW - 500_000 }),
      price({ assetPair: 'ADA/USD', timestamp: NOW - 1_000 }),
    ]
    const { result } = renderHook(() => useMarketOverviewStats(prices))
    expect(result.current.pairsByFilter.stale).toContain('XLM/USD')
    expect(result.current.pairsByFilter.stale).not.toContain('BTC/USD')
  })

  it('tracks 24h change once a baseline sample exists and updates on new ticks', () => {
    const initial = [price({ assetPair: 'BTC/USD', price: 100, timestamp: NOW })]
    const { result, rerender } = renderHook(({ p }: { p: PriceData[] }) => useMarketOverviewStats(p), {
      initialProps: { p: initial },
    })
    // No baseline recorded yet on the very first render (history starts empty).
    expect(result.current.changePct).toBeNull()

    // Advance past the sample interval and tick a new price — a baseline now exists.
    vi.setSystemTime(NOW + 61_000)
    const updated = [price({ assetPair: 'BTC/USD', price: 110, timestamp: NOW + 61_000 })]
    rerender({ p: updated })

    expect(result.current.changePct).not.toBeNull()
    expect(result.current.changePct).toBeCloseTo(10)
    expect(result.current.changeSinceSessionOnly).toBe(true)
  })

  it('flags a pair at its tracked high after a price increase', () => {
    const initial = [price({ assetPair: 'BTC/USD', price: 100, timestamp: NOW })]
    const { result, rerender } = renderHook(({ p }: { p: PriceData[] }) => useMarketOverviewStats(p), {
      initialProps: { p: initial },
    })

    vi.setSystemTime(NOW + 61_000)
    const higher = [price({ assetPair: 'BTC/USD', price: 150, timestamp: NOW + 61_000 })]
    rerender({ p: higher })

    expect(result.current.pairsByFilter.atHigh).toContain('BTC/USD')
    expect(result.current.pairsByFilter.atLow).not.toContain('BTC/USD')
  })

  it('recomputes stats on every prices reference change (WS tick)', () => {
    const { result, rerender } = renderHook(({ p }: { p: PriceData[] }) => useMarketOverviewStats(p), {
      initialProps: { p: [price({ confidence: 0.5 })] },
    })
    const first = result.current
    rerender({ p: [price({ confidence: 0.8 })] })
    expect(result.current).not.toBe(first)
    expect(result.current.avgConfidence).toBeCloseTo(0.8)
  })
})
