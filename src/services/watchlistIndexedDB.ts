/**
 * IndexedDB service for persisting custom watchlists.
 *
 * Uses a dedicated DB (`stellar-oracle-watchlists`) separate from the main
 * `stellar-oracle` cache so watchlist data is never subject to TTL eviction.
 */

export interface WatchlistEntry {
  id: string
  name: string
  pairs: string[]
  createdAt: number
  updatedAt: number
  order: number
}

const DB_NAME = 'stellar-oracle-watchlists'
const DB_VERSION = 1
const STORE_NAME = 'watchlists'

// ---------- DB lifecycle ----------

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/** Reset the cached promise — used in tests to get a clean DB. */
export function _resetWatchlistDB(): void {
  dbPromise = null
}

// ---------- Helpers ----------

function getStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

// ---------- Public API ----------

/**
 * Returns all watchlists sorted by `order` (ascending).
 * Returns an empty array when IndexedDB is unavailable (SSR / test env).
 */
export async function getAllWatchlists(): Promise<WatchlistEntry[]> {
  try {
    const db = await openDB()
    return new Promise<WatchlistEntry[]>((resolve, reject) => {
      const req = getStore(db, 'readonly').getAll()
      req.onsuccess = () => {
        const entries = (req.result ?? []) as WatchlistEntry[]
        entries.sort((a, b) => a.order - b.order)
        resolve(entries)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

/**
 * Inserts or updates a watchlist entry.
 */
export async function saveWatchlist(entry: WatchlistEntry): Promise<void> {
  try {
    const db = await openDB()
    return new Promise<void>((resolve, reject) => {
      const req = getStore(db, 'readwrite').put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Write failure is non-fatal
  }
}

/**
 * Deletes a watchlist by its `id`.
 */
export async function deleteWatchlist(id: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise<void>((resolve, reject) => {
      const req = getStore(db, 'readwrite').delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Delete failure is non-fatal
  }
}

/**
 * Removes all entries from the watchlists store.
 */
export async function clearWatchlists(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise<void>((resolve, reject) => {
      const req = getStore(db, 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Clear failure is non-fatal
  }
}
