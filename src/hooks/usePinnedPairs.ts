import { useCallback, useState } from 'react'
import {
  findPinnedPair,
  loadPinnedPairs,
  removePinnedPair,
  savePinnedPairs,
  upsertPinnedPair,
  type PinnedPairSnapshot,
} from '../utils/pinnedPairs'
import type { PriceData } from '../types'

export interface UsePinnedPairsResult {
  pins: PinnedPairSnapshot[]
  /** Returns the stored snapshot for a pair, or `undefined` when it is not pinned. */
  getPin: (assetPair: string) => PinnedPairSnapshot | undefined
  /** Pins a pair, or refreshes its snapshot when it is already pinned. */
  pin: (price: PriceData) => void
  /** Refreshes the snapshot of a pinned pair from live data. A no-op for unpinned pairs. */
  syncPrice: (price: PriceData) => void
  unpin: (assetPair: string) => void
}

function toSnapshot(price: PriceData): PinnedPairSnapshot {
  return { assetPair: price.assetPair, price: price.price, timestamp: price.timestamp, savedAt: Date.now() }
}

/**
 * Manages pinned pair snapshots for offline access (#831).
 *
 * Actions use functional state updates so their identity is stable. Callers can
 * safely list them in effect dependency arrays.
 */
export function usePinnedPairs(): UsePinnedPairsResult {
  const [pins, setPins] = useState<PinnedPairSnapshot[]>(loadPinnedPairs)

  const getPin = useCallback((assetPair: string) => findPinnedPair(pins, assetPair), [pins])

  const pin = useCallback((price: PriceData) => {
    setPins((current) => {
      const next = upsertPinnedPair(current, toSnapshot(price))
      savePinnedPairs(next)
      return next
    })
  }, [])

  const syncPrice = useCallback((price: PriceData) => {
    setPins((current) => {
      if (!findPinnedPair(current, price.assetPair)) return current
      const next = upsertPinnedPair(current, toSnapshot(price))
      savePinnedPairs(next)
      return next
    })
  }, [])

  const unpin = useCallback((assetPair: string) => {
    setPins((current) => {
      const next = removePinnedPair(current, assetPair)
      savePinnedPairs(next)
      return next
    })
  }, [])

  return { pins, getPin, pin, syncPrice, unpin }
}
