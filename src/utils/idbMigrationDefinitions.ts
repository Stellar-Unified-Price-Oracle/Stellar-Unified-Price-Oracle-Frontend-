/**
 * IndexedDB Schema Migrations for Stellar Oracle
 *
 * This file defines all schema changes across database versions.
 * Each migration is idempotent and can be re-run safely.
 *
 * Version History:
 * v1: Initial schema with prices, history, preferences stores
 * v2: Add pendingMutations store for offline-first sync queue
 * v3: Add indexes on commonly queried fields
 * v4: Add time-series engine stores (tsPoints, tsSeries)
 */

import { createMigrationRegistry, DataTransformer, createMigrationRunner } from './idbMigrations'
import type { MigrationStep } from './idbMigrations'

/**
 * v1: Create the initial stores
 * - prices: cached current price data (key: assetPair)
 * - history: cached price history (key: pair:timestamp)
 * - preferences: user preferences (key: fixed "preferences")
 */
export const v1Migration: MigrationStep = {
  version: 1,
  name: 'initial-schema',
  description: 'Create prices, history, and preferences stores',
  up: (db) => {
    for (const store of ['prices', 'history', 'preferences'] as const) {
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store, { keyPath: 'key' })
      }
    }
  },
}

/**
 * v2: Add background mutation queue
 * - pendingMutations: stores mutations to replay when back online
 */
export const v2Migration: MigrationStep = {
  version: 2,
  name: 'add-pending-mutations',
  description: 'Add background sync queue for offline mutations',
  up: (db) => {
    if (!db.objectStoreNames.contains('pendingMutations')) {
      db.createObjectStore('pendingMutations', { keyPath: 'id', autoIncrement: true })
    }
  },
  down: (db) => {
    if (db.objectStoreNames.contains('pendingMutations')) {
      db.deleteObjectStore('pendingMutations')
    }
  },
}

/**
 * v3: Add indexes for common queries
 * - Improves performance of filtering and sorting operations
 * - Indexes are added to stores without rewriting data
 */
export const v3Migration: MigrationStep = {
  version: 3,
  name: 'add-query-indexes',
  description: 'Add indexes for price history queries',
  up: (_, tx) => {
    // Add index on history store for time-based queries
    const historyStore = tx.objectStore('history')
    DataTransformer.createIndex(historyStore, 'by-pair', 'pair')
    DataTransformer.createIndex(historyStore, 'by-timestamp', 'timestamp')

    // Add index on pendingMutations for timestamp ordering
    const mutationStore = tx.objectStore('pendingMutations')
    DataTransformer.createIndex(mutationStore, 'by-timestamp', 'timestamp')
  },
}

/**
 * v4: Time-series engine stores.
 *
 * `tsPoints` is keyed by the compound `['series','tier','t']` so a range query
 * for one series/tier is a single primary-key scan, and retention deletes are
 * an upper-bound range. `tsSeries` records each concrete series' resolved
 * retention so maintenance can still trim a series whose descriptor is gone.
 * Existing data (legacy cache blobs, alert history) is imported at runtime by
 * the engine's callers, not here — a versionchange transaction cannot await the
 * extra reads an import needs.
 */
export const v4Migration: MigrationStep = {
  version: 4,
  name: 'add-time-series-engine',
  description: 'Create tsPoints and tsSeries stores for the time-series engine',
  up: (db) => {
    if (!db.objectStoreNames.contains('tsPoints')) {
      db.createObjectStore('tsPoints', { keyPath: ['series', 'tier', 't'] })
    }
    if (!db.objectStoreNames.contains('tsSeries')) {
      db.createObjectStore('tsSeries', { keyPath: 'series' })
    }
  },
  down: (db) => {
    if (db.objectStoreNames.contains('tsPoints')) db.deleteObjectStore('tsPoints')
    if (db.objectStoreNames.contains('tsSeries')) db.deleteObjectStore('tsSeries')
  },
}

/**
 * Example v5 migration showing data transformation.
 * This is here as a template for future migrations that need to transform data.
 * Uncomment and use when needed.
 *
 * v4: Normalize stored cache entries to new structure
 * Example: if CacheEntry format changes, this transforms old entries
 */
/*
export const v4Migration: MigrationStep = {
  version: 4,
  name: 'normalize-cache-entries',
  description: 'Transform cache entries to new v2 format',
  up: (_, tx) => {
    // Transform prices store
    const pricesStore = tx.objectStore('prices')
    DataTransformer.transformAll(pricesStore, (entry) => ({
      ...entry,
      // Add new required fields with defaults
      version: entry.version || 1,
      expiresAt: entry.expiresAt || Date.now() + 5 * 60 * 1000,
    }))

    // Transform history store
    const historyStore = tx.objectStore('history')
    DataTransformer.transformAll(historyStore, (entry) => ({
      ...entry,
      // Rename field if needed
      createdAt: entry.storedAt || entry.createdAt,
    }))
  },
  down: (_, tx) => {
    // Revert transformation if rolling back
    const pricesStore = tx.objectStore('prices')
    DataTransformer.transformAll(pricesStore, (entry) => {
      const { version, expiresAt, ...rest } = entry
      return rest
    })
  },
}
*/

/**
 * Create the app's migration registry with all defined migrations.
 */
export function createAppMigrationRegistry() {
  const registry = createMigrationRegistry()
  registry.register(1, v1Migration)
  registry.register(2, v2Migration)
  registry.register(3, v3Migration)
  registry.register(4, v4Migration)
  return registry
}

/**
 * Create a migration runner for the app's registry.
 */
export function createAppMigrationRunner() {
  const registry = createAppMigrationRegistry()
  return createMigrationRunner(registry)
}

export type { MigrationRunner } from './idbMigrations'

/**
 * The current target database version.
 * Update this when adding a new migration.
 */
export const CURRENT_DB_VERSION = 4
