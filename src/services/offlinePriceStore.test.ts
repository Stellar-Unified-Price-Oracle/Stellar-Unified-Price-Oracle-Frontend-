import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { idbCache } from '../hooks/useIndexedDB'
import type { PriceData } from '../types'
import { offlinePriceStore } from './offlinePriceStore'

const DEBOUNCE_MS = 2_000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function price(assetPair: string, value: number): PriceData {
  return { assetPair, price: value, timestamp: 1_000_000, confidence: 0.9, sources: ['reflector'] }
}

beforeEach(() => {
  // Only fake the timer and clock APIs; IndexedDB (fake-indexeddb) relies on real scheduling.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(1_000_000)
  idbCache._reset()
  idbCache._disableSyncQueue()
})

afterEach(async () => {
  await offlinePriceStore.clear()
  idbCache._reset()
  vi.useRealTimers()
})

describe('offlinePriceStore.persist', () => {
  it('writes only the latest snapshot after a burst of updates', async () => {
    offlinePriceStore.persist([price('XLM/USD', 0.1)])
    vi.advanceTimersByTime(1_000)
    offlinePriceStore.persist([price('XLM/USD', 0.2)])
    vi.advanceTimersByTime(1_000)
    offlinePriceStore.persist([price('XLM/USD', 0.3)])

    // Still inside the debounce window measured from the last call: nothing written yet.
    expect(await offlinePriceStore.load()).toBeNull()

    vi.advanceTimersByTime(DEBOUNCE_MS)
    const snapshot = await offlinePriceStore.load()
    expect(snapshot?.prices).toEqual([price('XLM/USD', 0.3)])
  })

  it('stamps the snapshot with the time it was flushed, not the time of the call', async () => {
    offlinePriceStore.persist([price('BTC/USD', 65_000)])
    vi.advanceTimersByTime(500)
    vi.advanceTimersByTime(DEBOUNCE_MS - 500)

    const snapshot = await offlinePriceStore.load()
    expect(snapshot?.savedAt).toBe(1_000_000 + DEBOUNCE_MS)
  })

  it('ignores an empty price list so a bad update never overwrites a good snapshot', async () => {
    offlinePriceStore.persist([price('XLM/USD', 0.1)])
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await offlinePriceStore.load()

    offlinePriceStore.persist([])
    vi.advanceTimersByTime(DEBOUNCE_MS)

    const snapshot = await offlinePriceStore.load()
    expect(snapshot?.prices).toEqual([price('XLM/USD', 0.1)])
  })
})

describe('offlinePriceStore.load', () => {
  it('returns null when no snapshot has ever been written', async () => {
    expect(await offlinePriceStore.load()).toBeNull()
  })

  it('keeps a snapshot for up to seven days, then expires it', async () => {
    offlinePriceStore.persist([price('XLM/USD', 0.1)])
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await offlinePriceStore.load()

    // TTL is measured from the flush time (the debounced write), not the original call.
    const flushedAt = 1_000_000 + DEBOUNCE_MS
    vi.setSystemTime(flushedAt + SEVEN_DAYS_MS - 1)
    expect(await offlinePriceStore.load()).not.toBeNull()

    vi.setSystemTime(flushedAt + SEVEN_DAYS_MS)
    expect(await offlinePriceStore.load()).toBeNull()
  })
})

describe('offlinePriceStore.clear', () => {
  it('removes a stored snapshot', async () => {
    offlinePriceStore.persist([price('XLM/USD', 0.1)])
    vi.advanceTimersByTime(DEBOUNCE_MS)
    await offlinePriceStore.load()

    await offlinePriceStore.clear()
    expect(await offlinePriceStore.load()).toBeNull()
  })

  it('cancels a pending debounced write so cleared data is not resurrected', async () => {
    offlinePriceStore.persist([price('XLM/USD', 0.1)])
    await offlinePriceStore.clear()

    vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    expect(await offlinePriceStore.load()).toBeNull()
  })
})
