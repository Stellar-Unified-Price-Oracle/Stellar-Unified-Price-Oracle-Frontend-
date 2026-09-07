import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  v1Migration,
  v2Migration,
  createAppMigrationRegistry,
  createAppMigrationRunner,
  CURRENT_DB_VERSION,
} from './idbMigrationDefinitions'
import type { MigrationRunner } from './idbMigrations'

function deleteTestDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Open `name` at `version`, running the app migration runner inside the
 * versionchange transaction (the only place schema changes are legal). Mirrors
 * the production open path in src/hooks/useIndexedDB.ts.
 */
function openWithMigrations(
  name: string,
  version: number,
  runner: MigrationRunner,
): Promise<{ db: IDBDatabase; applied: number }> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version)
    let applied = 0
    req.onupgradeneeded = async () => {
      try {
        applied = await runner.run(req.result, req.transaction!, version)
      } catch (error) {
        req.transaction!.abort()
        reject(error as Error)
      }
    }
    req.onsuccess = () => resolve({ db: req.result, applied })
    req.onerror = () => reject(req.error)
  })
}

describe('Migration Definitions', () => {
  let db: IDBDatabase | null = null

  beforeEach(async () => {
    await deleteTestDB('migration-def-test')
  })

  afterEach(async () => {
    if (db) db.close()
    db = null
    await deleteTestDB('migration-def-test')
  })

  describe('CURRENT_DB_VERSION', () => {
    it('is set to 3', () => {
      expect(CURRENT_DB_VERSION).toBe(3)
    })
  })

  describe('createAppMigrationRegistry', () => {
    it('registers all migrations', () => {
      const registry = createAppMigrationRegistry()
      expect(registry.getLatestVersion()).toBe(3)
    })

    it('has all migrations in order', () => {
      const registry = createAppMigrationRegistry()
      const all = registry.getAll()

      expect(all).toHaveLength(3)
      expect(all[0].version).toBe(1)
      expect(all[1].version).toBe(2)
      expect(all[2].version).toBe(3)
    })
  })

  describe('v1Migration', () => {
    it('creates stores', async () => {
      const runner = createAppMigrationRunner()
      const { db: opened } = await openWithMigrations('migration-def-test', 1, runner)
      db = opened

      const stores = Array.from(opened.objectStoreNames)
      expect(stores).toContain('prices')
      expect(stores).toContain('history')
      expect(stores).toContain('preferences')
    })

    it('creates stores with correct keyPath', async () => {
      const runner = createAppMigrationRunner()
      const { db: opened } = await openWithMigrations('migration-def-test', 1, runner)
      db = opened

      const priceStore = opened.transaction('prices', 'readonly').objectStore('prices')
      expect(priceStore.keyPath).toBe('key')
    })
  })

  describe('v2Migration', () => {
    it('creates pendingMutations store', async () => {
      const runner = createAppMigrationRunner()
      const { db: opened } = await openWithMigrations('migration-def-test', 2, runner)
      db = opened

      expect(opened.objectStoreNames.contains('pendingMutations')).toBe(true)

      const mutationStore = opened.transaction('pendingMutations', 'readonly').objectStore('pendingMutations')
      expect(mutationStore.keyPath).toBe('id')
      expect(mutationStore.autoIncrement).toBe(true)
    })

    it('can be rolled back', async () => {
      // v2's down is exercised inside the same versionchange transaction that
      // created the store — the only context in which deleteObjectStore is legal.
      const { db: opened } = await openWithMigrations('migration-def-test', 2, createAppMigrationRunner())
      opened.close()

      const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('migration-def-test', 3)
        req.onupgradeneeded = () => {
          const tx = req.transaction!
          // Ensure the schema from v1/v2 is present, then roll v2 back.
          v1Migration.up(req.result, tx)
          v2Migration.up(req.result, tx)
          v2Migration.down?.(req.result, tx)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      db = reopened

      expect(reopened.objectStoreNames.contains('pendingMutations')).toBe(false)
    })
  })

  describe('v3Migration', () => {
    it('adds indexes', async () => {
      const runner = createAppMigrationRunner()
      const { db: opened } = await openWithMigrations('migration-def-test', 3, runner)
      db = opened

      const historyStore = opened.transaction('history', 'readonly').objectStore('history')
      expect(historyStore.indexNames.contains('by-pair')).toBe(true)
      expect(historyStore.indexNames.contains('by-timestamp')).toBe(true)

      const mutationStore = opened.transaction('pendingMutations', 'readonly').objectStore('pendingMutations')
      expect(mutationStore.indexNames.contains('by-timestamp')).toBe(true)
    })
  })

  describe('createAppMigrationRunner', () => {
    it('creates a migration runner with all migrations', () => {
      const runner = createAppMigrationRunner()
      expect(runner).toBeDefined()
    })

    it('can execute all migrations', async () => {
      const runner = createAppMigrationRunner()
      const { db: opened, applied } = await openWithMigrations('migration-def-test', CURRENT_DB_VERSION, runner)
      db = opened

      expect(applied).toBe(3)

      // Verify all stores exist
      expect(opened.objectStoreNames.contains('prices')).toBe(true)
      expect(opened.objectStoreNames.contains('history')).toBe(true)
      expect(opened.objectStoreNames.contains('preferences')).toBe(true)
      expect(opened.objectStoreNames.contains('pendingMutations')).toBe(true)

      // Verify indexes
      const historyStore = opened.transaction('history', 'readonly').objectStore('history')
      expect(historyStore.indexNames.contains('by-pair')).toBe(true)
    })

    it('records migration history', async () => {
      const runner = createAppMigrationRunner()
      const { db: opened } = await openWithMigrations('migration-def-test', CURRENT_DB_VERSION, runner)
      db = opened

      const history = await runner.getMigrationHistory(opened)

      expect(history).toHaveLength(3)
      expect(history[0].name).toBe('initial-schema')
      expect(history[1].name).toBe('add-pending-mutations')
      expect(history[2].name).toBe('add-query-indexes')
    })
  })

  describe('Integration', () => {
    it('can progressively apply migrations', async () => {
      const runner = createAppMigrationRunner()

      // Start with v1
      const step1 = await openWithMigrations('migration-def-test', 1, runner)
      expect(step1.applied).toBe(1)
      expect(await runner.getCurrentVersion(step1.db)).toBe(1)
      step1.db.close()

      // Progress to v2
      const step2 = await openWithMigrations('migration-def-test', 2, runner)
      expect(step2.applied).toBe(1)
      expect(await runner.getCurrentVersion(step2.db)).toBe(2)
      expect(step2.db.objectStoreNames.contains('pendingMutations')).toBe(true)
      step2.db.close()

      // Progress to v3
      const step3 = await openWithMigrations('migration-def-test', 3, runner)
      db = step3.db
      expect(step3.applied).toBe(1)
      expect(await runner.getCurrentVersion(step3.db)).toBe(3)

      const historyStore = step3.db.transaction('history', 'readonly').objectStore('history')
      expect(historyStore.indexNames.contains('by-pair')).toBe(true)
    })

    it('idempotently applies migrations', async () => {
      const runner = createAppMigrationRunner()
      const first = await openWithMigrations('migration-def-test', CURRENT_DB_VERSION, runner)
      first.db.close()

      // Re-opening at the current version fires no versionchange event, so no
      // migration re-runs and the recorded history is not duplicated.
      const second = await openWithMigrations('migration-def-test', CURRENT_DB_VERSION, runner)
      db = second.db

      expect(second.applied).toBe(0)
      const history = await runner.getMigrationHistory(second.db)
      expect(history).toHaveLength(3)
    })
  })
})
