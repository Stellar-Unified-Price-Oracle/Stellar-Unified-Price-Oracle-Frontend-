/**
 * Offline-first price snapshot store (#470).
 *
 * Persists the latest confirmed price snapshot to the shared IndexedDB cache
 * (`prices` store, see `hooks/useIndexedDB.ts`) so the dashboard can render
 * last-known prices — with a stale badge — instead of going blank when the
 * network drops. Writes are debounced so a burst of WS-confirmed updates
 * doesn't hammer IndexedDB. Size is bounded by the shared cache's 50 MB LRU
 * eviction, and the snapshot survives reloads because it's real IndexedDB.
 */
import { idbCache } from '../hooks/useIndexedDB'
import type { PriceData } from '../types'

const STORE = 'prices' as const
const SNAPSHOT_KEY = 'offline-snapshot'
/** Long TTL — a real outage can last hours, so don't let the snapshot expire mid-use. */
const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEBOUNCE_MS = 2_000

export interface OfflineSnapshot {
  prices: PriceData[]
  savedAt: number
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const offlinePriceStore = {
  /** Debounced write of the latest confirmed price snapshot to IndexedDB. */
  persist(prices: PriceData[]): void {
    if (prices.length === 0) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      const snapshot: OfflineSnapshot = { prices, savedAt: Date.now() }
      void idbCache.set(STORE, SNAPSHOT_KEY, snapshot)
    }, DEBOUNCE_MS)
  },

  /** Loads the last persisted snapshot, or `null` if none exists / it expired. */
  async load(): Promise<OfflineSnapshot | null> {
    return idbCache.get<OfflineSnapshot>(STORE, SNAPSHOT_KEY, SNAPSHOT_TTL_MS)
  },

  /** Clears the cached offline snapshot — the manual "clear cache" action in Settings. */
  async clear(): Promise<void> {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    await idbCache.delete(STORE, SNAPSHOT_KEY)
  },
}
