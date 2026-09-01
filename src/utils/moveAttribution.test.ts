import { describe, it, expect } from 'vitest'
import {
  computeAttribution,
  appendToRingBuffer,
  type SourcePriceState,
} from './moveAttribution'
import { ATTRIBUTION_RING_BUFFER_SIZE } from '../types'
import type { WsPriceUpdate, MoveAttribution } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePriceUpdate(overrides: Partial<WsPriceUpdate> = {}): WsPriceUpdate {
  return {
    type: 'price_update',
    assetPair: 'BTC/USD',
    price: 50000,
    timestamp: 1_700_000_000_000,
    confidence: 0.99,
    sources: ['chainlink', 'redstone'],
    ...overrides,
  }
}

// ── computeAttribution ───────────────────────────────────────────────────────

describe('computeAttribution', () => {
  it('returns null deltas on the first tick (no prior data)', () => {
    const state: SourcePriceState = {}
    const msg = makePriceUpdate()

    const result = computeAttribution(msg, state, null)

    expect(result.assetPair).toBe('BTC/USD')
    expect(result.price).toBe(50000)
    expect(result.delta).toBeNull()
    expect(result.deltaPercent).toBeNull()

    for (const sd of result.sources) {
      expect(sd.delta).toBeNull()
      expect(sd.deltaPercent).toBeNull()
      expect(sd.prevPrice).toBeNull()
    }
  })

  it('computes aggregate delta on subsequent ticks', () => {
    const state: SourcePriceState = {}
    const first = makePriceUpdate({ price: 50000 })
    computeAttribution(first, state, null)

    const second = makePriceUpdate({ price: 50100 })
    const result = computeAttribution(second, state, 50000)

    expect(result.delta).toBeCloseTo(100)
    expect(result.deltaPercent).toBeCloseTo(0.2)
  })

  it('computes negative aggregate delta', () => {
    const state: SourcePriceState = {}
    computeAttribution(makePriceUpdate({ price: 50000 }), state, null)

    const second = makePriceUpdate({ price: 49500 })
    const result = computeAttribution(second, state, 50000)

    expect(result.delta).toBeCloseTo(-500)
    expect(result.deltaPercent).toBeCloseTo(-1)
  })

  it('uses per-source prices from sourcePrices when provided', () => {
    const state: SourcePriceState = {}
    const first = makePriceUpdate({
      price: 50000,
      sourcePrices: { chainlink: 50010, redstone: 49990 },
    })
    computeAttribution(first, state, null)

    const second = makePriceUpdate({
      price: 50100,
      sourcePrices: { chainlink: 50120, redstone: 50080 },
    })
    const result = computeAttribution(second, state, 50000)

    const chainlink = result.sources.find((s) => s.source === 'chainlink')!
    const redstone = result.sources.find((s) => s.source === 'redstone')!

    expect(chainlink.price).toBe(50120)
    expect(chainlink.prevPrice).toBe(50010)
    expect(chainlink.delta).toBeCloseTo(110)

    expect(redstone.price).toBe(50080)
    expect(redstone.prevPrice).toBe(49990)
    expect(redstone.delta).toBeCloseTo(90)
  })

  it('falls back to aggregate price for sources without per-source data', () => {
    const state: SourcePriceState = {}
    computeAttribution(makePriceUpdate({ price: 50000 }), state, null)

    const second = makePriceUpdate({ price: 50100 })
    const result = computeAttribution(second, state, 50000)

    for (const sd of result.sources) {
      // Without sourcePrices every source gets the aggregate
      expect(sd.price).toBe(50100)
    }
  })

  it('identifies the leading source (largest absolute delta)', () => {
    const state: SourcePriceState = {}
    computeAttribution(
      makePriceUpdate({ price: 50000, sourcePrices: { chainlink: 50050, redstone: 49980 } }),
      state,
      null,
    )

    const second = makePriceUpdate({
      price: 50100,
      sourcePrices: { chainlink: 50200, redstone: 50020 }, // chainlink moved +150, redstone +40
    })
    const result = computeAttribution(second, state, 50000)

    expect(result.leadingSources).toContain('chainlink')
    expect(result.leadingSources).not.toContain('redstone')
  })

  it('identifies multiple leaders when tied', () => {
    const state: SourcePriceState = {}
    computeAttribution(
      makePriceUpdate({ price: 50000, sourcePrices: { chainlink: 50000, redstone: 50000 } }),
      state,
      null,
    )

    // Both move by exactly +100
    const second = makePriceUpdate({
      price: 50100,
      sourcePrices: { chainlink: 50100, redstone: 50100 },
    })
    const result = computeAttribution(second, state, 50000)

    expect(result.leadingSources).toContain('chainlink')
    expect(result.leadingSources).toContain('redstone')
  })

  it('returns empty leadingSources on the first tick', () => {
    const state: SourcePriceState = {}
    const result = computeAttribution(makePriceUpdate(), state, null)
    expect(result.leadingSources).toHaveLength(0)
  })

  it('mutates prevSourcePrices in place for next-tick computation', () => {
    const state: SourcePriceState = {}
    computeAttribution(makePriceUpdate({ price: 50000 }), state, null)

    // State should now contain prices from the first tick
    expect(state['chainlink']).toBe(50000)
    expect(state['redstone']).toBe(50000)
  })

  it('handles deltaPercent as null when prevPrice is zero', () => {
    const state: SourcePriceState = { chainlink: 0, redstone: 0 }
    const result = computeAttribution(makePriceUpdate({ price: 100 }), state, 0)

    // aggregate deltaPercent: prevPrice=0 → null
    expect(result.deltaPercent).toBeNull()
    // per-source deltaPercent: prevPrice=0 → null
    for (const sd of result.sources) {
      expect(sd.deltaPercent).toBeNull()
    }
  })
})

// ── appendToRingBuffer ───────────────────────────────────────────────────────

describe('appendToRingBuffer', () => {
  function makeRecord(price: number): MoveAttribution {
    return {
      assetPair: 'BTC/USD',
      timestamp: Date.now(),
      price,
      delta: null,
      deltaPercent: null,
      sources: [],
      leadingSources: [],
    }
  }

  it('appends to an empty buffer', () => {
    const record = makeRecord(50000)
    const result = appendToRingBuffer([], record)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(record)
  })

  it('does not mutate the input array', () => {
    const initial = [makeRecord(1), makeRecord(2)]
    const frozen = [...initial]
    appendToRingBuffer(initial, makeRecord(3))
    expect(initial).toEqual(frozen)
  })

  it('evicts the oldest entry when the buffer is full', () => {
    const full: MoveAttribution[] = Array.from(
      { length: ATTRIBUTION_RING_BUFFER_SIZE },
      (_, i) => makeRecord(i),
    )
    const newRecord = makeRecord(9999)
    const result = appendToRingBuffer(full, newRecord)

    expect(result).toHaveLength(ATTRIBUTION_RING_BUFFER_SIZE)
    // Oldest entry (price=0) should be gone
    expect(result[0].price).toBe(1)
    // Newest entry should be at the end
    expect(result[result.length - 1]).toBe(newRecord)
  })

  it(`maintains at most ${ATTRIBUTION_RING_BUFFER_SIZE} entries`, () => {
    let buffer: MoveAttribution[] = []
    for (let i = 0; i < ATTRIBUTION_RING_BUFFER_SIZE + 10; i++) {
      buffer = appendToRingBuffer(buffer, makeRecord(i))
    }
    expect(buffer.length).toBe(ATTRIBUTION_RING_BUFFER_SIZE)
  })

  it('preserves order (oldest first, newest last)', () => {
    let buffer: MoveAttribution[] = []
    for (let i = 0; i < 5; i++) {
      buffer = appendToRingBuffer(buffer, makeRecord(i * 100))
    }
    const prices = buffer.map((r) => r.price)
    expect(prices).toEqual([0, 100, 200, 300, 400])
  })
})
