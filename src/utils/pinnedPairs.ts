/**
 * Pinned pair snapshots for offline access (#831).
 *
 * A pin stores the last price the app saw for a pair, so the pair's detail page
 * can still show something useful when the network is unavailable. Snapshots are
 * kept small and capped; they are never treated as live data by the UI.
 */

import { readJson, writeJson, STORAGE_KEYS } from './storage'

/** Upper bound on pinned pairs, keeping the stored payload small. */
export const MAX_PINNED_PAIRS = 20

export interface PinnedPairSnapshot {
  assetPair: string
  /** Aggregated price at the time of pinning or the last refresh while pinned. */
  price: number
  /** Unix ms timestamp of the price itself, as reported by the oracle. */
  timestamp: number
  /** Unix ms timestamp of when this snapshot was written locally. */
  savedAt: number
}

function isSnapshot(value: unknown): value is PinnedPairSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.assetPair === 'string' &&
    typeof candidate.price === 'number' &&
    Number.isFinite(candidate.price) &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.savedAt === 'number'
  )
}

function isSnapshotList(value: unknown): value is PinnedPairSnapshot[] {
  return Array.isArray(value) && value.every(isSnapshot)
}

/** Reads pinned snapshots. Corrupt or missing data yields an empty list. */
export function loadPinnedPairs(): PinnedPairSnapshot[] {
  return readJson<PinnedPairSnapshot[]>(STORAGE_KEYS.pinnedPairs, [], isSnapshotList)
}

/** Persists the list. Returns `false` when storage is unavailable. */
export function savePinnedPairs(pins: PinnedPairSnapshot[]): boolean {
  return writeJson(STORAGE_KEYS.pinnedPairs, pins)
}

/**
 * Returns a new list with `snapshot` added or replaced for its pair. The newest
 * pin goes first. When the cap is exceeded, the oldest pin is dropped.
 */
export function upsertPinnedPair(pins: PinnedPairSnapshot[], snapshot: PinnedPairSnapshot): PinnedPairSnapshot[] {
  const rest = pins.filter((pin) => pin.assetPair !== snapshot.assetPair)
  return [snapshot, ...rest].slice(0, MAX_PINNED_PAIRS)
}

/** Returns a new list without `assetPair`. */
export function removePinnedPair(pins: PinnedPairSnapshot[], assetPair: string): PinnedPairSnapshot[] {
  return pins.filter((pin) => pin.assetPair !== assetPair)
}

/** Finds the snapshot for `assetPair`, if the pair is pinned. */
export function findPinnedPair(pins: PinnedPairSnapshot[], assetPair: string): PinnedPairSnapshot | undefined {
  return pins.find((pin) => pin.assetPair === assetPair)
}
