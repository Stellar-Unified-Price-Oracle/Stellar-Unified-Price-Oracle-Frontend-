/**
 * Lightweight IndexedDB cache layer (no external deps).
 * Stores prices, price history, and preferences with TTL + LRU eviction.
 * Max cache size: 50 MB (enforced by evicting oldest entries).
 */

const DB_NAME = 'stellar-oracle'
const DB_VERSION = 1
const TTL_MS = 5 * 60 * 1000 // 5 minutes default
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

interface CacheEntry<T> {
  key: string
  value: T
  size: number       // approximate byte size
  storedAt: number   // epoch ms
  accessedAt: number // for LRU
}

type StoreName = 'prices' | 'history' | 'preferences'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of ['prices', 'history', 'preferences'] as StoreName[]) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'key' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function byteSize(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value)).length } catch { return 0 }
}

function tx(db: IDBDatabase, store: StoreName, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store)
}

function idbGet<T>(db: IDBDatabase, store: StoreName, key: string): Promise<CacheEntry<T> | undefined> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').get(key)
    req.onsuccess = () => resolve(req.result as CacheEntry<T> | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, store: StoreName, entry: CacheEntry<unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, store: StoreName, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll<T>(db: IDBDatabase, store: StoreName): Promise<CacheEntry<T>[]> {
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').getAll()
    req.onsuccess = () => resolve(req.result as CacheEntry<T>[])
    req.onerror = () => reject(req.error)
  })
}

/** Evict LRU entries until total size is under MAX_BYTES */
async function evict(db: IDBDatabase, store: StoreName) {
  const all = await idbGetAll(db, store)
  let total = all.reduce((s, e) => s + e.size, 0)
  if (total <= MAX_BYTES) return
  // Sort by LRU (oldest access first)
  all.sort((a, b) => a.accessedAt - b.accessedAt)
  for (const entry of all) {
    if (total <= MAX_BYTES) break
    await idbDelete(db, store, entry.key)
    total -= entry.size
  }
}

export const idbCache = {
  async get<T>(store: StoreName, key: string, ttl = TTL_MS): Promise<T | null> {
    try {
      const db = await openDB()
      const entry = await idbGet<T>(db, store, key)
      if (!entry) return null
      if (Date.now() - entry.storedAt > ttl) {
        await idbDelete(db, store, key)
        return null
      }
      // Update access time for LRU (fire-and-forget)
      idbPut(db, store, { ...entry, accessedAt: Date.now() }).catch(() => {})
      return entry.value
    } catch {
      return null
    }
  },

  async set<T>(store: StoreName, key: string, value: T): Promise<void> {
    try {
      const db = await openDB()
      const size = byteSize(value)
      const now = Date.now()
      await idbPut(db, store, { key, value, size, storedAt: now, accessedAt: now })
      await evict(db, store)
    } catch {
      // Cache write failure is non-fatal
    }
  },

  async delete(store: StoreName, key: string): Promise<void> {
    try {
      const db = await openDB()
      await idbDelete(db, store, key)
    } catch { /* cache delete failure is non-fatal */ }
  },

  async clear(store: StoreName): Promise<void> {
    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const req = tx(db, store, 'readwrite').clear()
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch { /* cache clear failure is non-fatal */ }
  },
}
