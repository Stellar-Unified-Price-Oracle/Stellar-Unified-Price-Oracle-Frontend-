/**
 * Enhanced IndexedDB cache layer (no external deps).
 * Stores prices, price history, and preferences with:
 * - TTL + LRU eviction with mutex to prevent race conditions
 * - Schema migration support (versioned upgrades)
 * - Cross-tab synchronization via BroadcastChannel
 * - Observable queries (subscribe to key changes)
 * - Cache-first, network-first, and stale-while-revalidate strategies
 * - Background mutation queue for offline → online replay
 *
 * Migrations are automatically applied when opening the database via
 * the migration system (src/utils/idbMigrations.ts).
 */

import { createAppMigrationRunner, CURRENT_DB_VERSION } from '../utils/idbMigrationDefinitions'
import type { MigrationRunner } from '../utils/idbMigrations'

const DB_NAME = 'stellar-oracle'
const DB_VERSION = CURRENT_DB_VERSION
const TTL_MS = 5 * 60 * 1000 // 5 minutes default
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

interface CacheEntry<T> {
  key: string
  value: T
  size: number
  storedAt: number
  accessedAt: number
}

export type StoreName = 'prices' | 'history' | 'preferences'

// ---------- Mutex ----------

class Mutex {
  private queue: Array<() => void> = []
  private locked = false

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }

  async runExclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

const evictionMutex = new Mutex()

// ---------- Schema Migrations ----------

let migrationRunner: MigrationRunner | null = null

function getMigrationRunner(): MigrationRunner {
  if (!migrationRunner) {
    migrationRunner = createAppMigrationRunner()
  }
  return migrationRunner
}

// ---------- Database ----------

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = async () => {
      const db = req.result
      const transaction = req.transaction!
      try {
        // Run migrations via the migration system
        const runner = getMigrationRunner()
        const currentVersion = await runner.getCurrentVersion(db)
        await runner.run(db, currentVersion, DB_VERSION)
      } catch (error) {
        transaction.abort()
        reject(error)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function byteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length
  } catch {
    return 0
  }
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

/** Evict LRU entries until total size is under MAX_BYTES (mutex-protected) */
async function evict(db: IDBDatabase, store: StoreName) {
  await evictionMutex.runExclusive(async () => {
    const all = await idbGetAll(db, store)
    let total = all.reduce((s, e) => s + e.size, 0)
    if (total <= MAX_BYTES) return
    all.sort((a, b) => a.accessedAt - b.accessedAt)
    for (const entry of all) {
      if (total <= MAX_BYTES) break
      await idbDelete(db, store, entry.key)
      total -= entry.size
    }
  })
}

// ---------- Observable Queries ----------

type Subscriber<T> = (value: T | null) => void

const subscribers = new Map<string, Set<Subscriber<unknown>>>()

function notifySubscribers(store: StoreName, key: string, value: unknown | null) {
  const fullKey = `${store}:${key}`
  const subs = subscribers.get(fullKey)
  if (subs) {
    for (const fn of subs) {
      try {
        fn(value)
      } catch {
        // subscriber errors are non-fatal
      }
    }
  }
  // Also notify wildcard subscribers for the store
  const storeKey = `${store}:*`
  const storeSubs = subscribers.get(storeKey)
  if (storeSubs) {
    for (const fn of storeSubs) {
      try {
        fn(value)
      } catch {
        // subscriber errors are non-fatal
      }
    }
  }
}

function subscribe(store: StoreName, key: string, callback: Subscriber<unknown>): () => void {
  const fullKey = `${store}:${key}`
  if (!subscribers.has(fullKey)) {
    subscribers.set(fullKey, new Set())
  }
  subscribers.get(fullKey)!.add(callback)
  return () => {
    const subs = subscribers.get(fullKey)
    if (subs) {
      subs.delete(callback)
      if (subs.size === 0) subscribers.delete(fullKey)
    }
  }
}

// ---------- Cross-Tab Synchronization ----------

let broadcastChannel: BroadcastChannel | null = null

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel('stellar-oracle-cache')
    broadcastChannel.onmessage = (event) => {
      const { store, key, value } = event.data as {
        store: StoreName
        key: string
        value: unknown | null
      }
      notifySubscribers(store, key, value)
    }
  }
  return broadcastChannel
}

function broadcastChange(store: StoreName, key: string, value: unknown | null) {
  const channel = getBroadcastChannel()
  if (channel) {
    channel.postMessage({ store, key, value })
  }
}

// ---------- Background Sync Queue ----------

interface PendingMutation {
  id?: number
  store: StoreName
  key: string
  value: unknown
  timestamp: number
}

let syncQueueEnabled = true

async function queueMutation(store: StoreName, key: string, value: unknown): Promise<void> {
  if (!syncQueueEnabled) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('pendingMutations', 'readwrite')
      const storeObj = transaction.objectStore('pendingMutations')
      const mutation: PendingMutation = { store, key, value, timestamp: Date.now() }
      const req = storeObj.add(mutation)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Queue write failure is non-fatal
  }
}

async function replayPendingMutations(): Promise<number> {
  let count = 0
  try {
    const db = await openDB()
    const mutations = await new Promise<PendingMutation[]>((resolve, reject) => {
      const transaction = db.transaction('pendingMutations', 'readwrite')
      const storeObj = transaction.objectStore('pendingMutations')
      const req = storeObj.getAll()
      req.onsuccess = () => resolve(req.result as PendingMutation[])
      req.onerror = () => reject(req.error)
    })

    // Sort by timestamp to replay in order
    mutations.sort((a, b) => a.timestamp - b.timestamp)

    for (const mutation of mutations) {
      try {
        const size = byteSize(mutation.value)
        const now = Date.now()
        await idbPut(db, mutation.store as StoreName, {
          key: mutation.key,
          value: mutation.value,
          size,
          storedAt: now,
          accessedAt: now,
        })
        notifySubscribers(mutation.store as StoreName, mutation.key, mutation.value)
        count++
      } catch {
        // Individual mutation replay failure is non-fatal
      }
    }

    // Clear processed mutations
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('pendingMutations', 'readwrite')
      const storeObj = transaction.objectStore('pendingMutations')
      const req = storeObj.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Replay failure is non-fatal
  }
  return count
}

function setupOnlineListener() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    replayPendingMutations().catch(() => {})
  })
}

// Initialize online listener
if (typeof window !== 'undefined') {
  setupOnlineListener()
}

// ---------- Cache Strategies ----------

type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate'

interface FetchWithCacheOptions {
  strategy?: CacheStrategy
  ttl?: number
  store?: StoreName
}

// ---------- Main API ----------

export const idbCache = {
  async get<T>(store: StoreName, key: string, ttl = TTL_MS): Promise<T | null> {
    try {
      const db = await openDB()
      const entry = await idbGet<T>(db, store, key)
      if (!entry) return null
      if (Date.now() - entry.storedAt > ttl) {
        await idbDelete(db, store, key)
        notifySubscribers(store, key, null)
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
      notifySubscribers(store, key, value)
      broadcastChange(store, key, value)
      await evict(db, store)
    } catch {
      // Cache write failure is non-fatal
      if (navigator.onLine === false) {
        await queueMutation(store, key, value)
      }
    }
  },

  async delete(store: StoreName, key: string): Promise<void> {
    try {
      const db = await openDB()
      await idbDelete(db, store, key)
      notifySubscribers(store, key, null)
      broadcastChange(store, key, null)
    } catch {
      // Cache delete failure is non-fatal
    }
  },

  async clear(store: StoreName): Promise<void> {
    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const req = tx(db, store, 'readwrite').clear()
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
      notifySubscribers(store, '*', null)
    } catch {
      // Cache clear failure is non-fatal
    }
  },

  subscribe,
  replayPendingMutations,

  /** Fetch with a cache strategy. Returns cached data immediately for cache-first. */
  async fetchWithCache<T>(
    store: StoreName,
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: FetchWithCacheOptions = {},
  ): Promise<T | null> {
    const { strategy = 'cache-first', ttl = TTL_MS } = options

    switch (strategy) {
      case 'cache-first': {
        const cached = await idbCache.get<T>(store, key, ttl)
        if (cached !== null) return cached
        try {
          const result = await fetcher()
          await idbCache.set(store, key, result)
          return result
        } catch {
          return null
        }
      }
      case 'network-first': {
        try {
          const result = await fetcher()
          await idbCache.set(store, key, result)
          return result
        } catch {
          return idbCache.get<T>(store, key, ttl)
        }
      }
      case 'stale-while-revalidate': {
        const cached = await idbCache.get<T>(store, key, ttl)
        // Revalidate in background regardless
        fetcher()
          .then(async (result) => {
            await idbCache.set(store, key, result)
          })
          .catch(() => {})
        return cached
      }
      default:
        return idbCache.get<T>(store, key, ttl)
    }
  },

  /** Reset the DB promise so next call re-opens (for testing) */
  _reset() {
    dbPromise = null
    evictionMutex['locked'] = false
    evictionMutex['queue'] = []
    syncQueueEnabled = true
  },

  /** Disable sync queue (for testing) */
  _disableSyncQueue() {
    syncQueueEnabled = false
  },
}
