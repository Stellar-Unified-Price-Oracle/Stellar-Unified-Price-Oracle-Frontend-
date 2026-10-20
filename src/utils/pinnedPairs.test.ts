import { describe, it, expect, beforeEach } from 'vitest'
import {
  MAX_PINNED_PAIRS,
  findPinnedPair,
  loadPinnedPairs,
  removePinnedPair,
  savePinnedPairs,
  upsertPinnedPair,
  type PinnedPairSnapshot,
} from './pinnedPairs'
import { STORAGE_KEYS } from './storage'

const snap = (assetPair: string, price = 1, savedAt = 1_000): PinnedPairSnapshot => ({
  assetPair,
  price,
  timestamp: 900,
  savedAt,
})

beforeEach(() => {
  localStorage.clear()
})

describe('upsertPinnedPair', () => {
  it('puts a new pin first', () => {
    const next = upsertPinnedPair([snap('XLM/USD')], snap('BTC/USD'))
    expect(next.map((p) => p.assetPair)).toEqual(['BTC/USD', 'XLM/USD'])
  })

  it('replaces an existing pin for the same pair instead of duplicating it', () => {
    const next = upsertPinnedPair([snap('XLM/USD', 1), snap('BTC/USD')], snap('XLM/USD', 2, 5_000))
    expect(next).toHaveLength(2)
    expect(findPinnedPair(next, 'XLM/USD')).toEqual(snap('XLM/USD', 2, 5_000))
    expect(next[0].assetPair).toBe('XLM/USD')
  })

  it('drops the oldest pin once the cap is reached', () => {
    const full = Array.from({ length: MAX_PINNED_PAIRS }, (_, i) => snap(`P${i}/USD`))
    const next = upsertPinnedPair(full, snap('NEW/USD'))
    expect(next).toHaveLength(MAX_PINNED_PAIRS)
    expect(findPinnedPair(next, 'NEW/USD')).toBeDefined()
    expect(findPinnedPair(next, `P${MAX_PINNED_PAIRS - 1}/USD`)).toBeUndefined()
  })

  it('does not mutate its input', () => {
    const original = [snap('XLM/USD')]
    upsertPinnedPair(original, snap('BTC/USD'))
    expect(original).toEqual([snap('XLM/USD')])
  })
})

describe('removePinnedPair', () => {
  it('removes only the named pair', () => {
    const next = removePinnedPair([snap('XLM/USD'), snap('BTC/USD')], 'XLM/USD')
    expect(next.map((p) => p.assetPair)).toEqual(['BTC/USD'])
  })

  it('is a no-op for a pair that is not pinned', () => {
    const pins = [snap('XLM/USD')]
    expect(removePinnedPair(pins, 'ETH/USD')).toEqual(pins)
  })
})

describe('storage round trip', () => {
  it('saves and loads pins under the registered key', () => {
    const pins = [snap('XLM/USD', 0.12)]
    expect(savePinnedPairs(pins)).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedPairs) ?? 'null')).toEqual(pins)
    expect(loadPinnedPairs()).toEqual(pins)
  })

  it('treats corrupt JSON as no pins', () => {
    localStorage.setItem(STORAGE_KEYS.pinnedPairs, '{not json')
    expect(loadPinnedPairs()).toEqual([])
  })

  it('rejects entries that fail validation instead of trusting them', () => {
    localStorage.setItem(STORAGE_KEYS.pinnedPairs, JSON.stringify([{ assetPair: 'XLM/USD', price: 'NaN-ish' }]))
    expect(loadPinnedPairs()).toEqual([])
  })
})
