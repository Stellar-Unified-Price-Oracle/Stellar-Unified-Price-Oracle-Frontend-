import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  v1Migration,
  v2Migration,
  v3Migration,
  createAppMigrationRegistry,
  createAppMigrationRunner,
  CURRENT_DB_VERSION,
} from './idbMigrationDefinitions'

function deleteTestDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function createTestDB(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('migration-def-test', version)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('Migration Definitions', () => {
  beforeEach(async () => {
    await deleteTestDB('migration-def-test')
  })

  afterEach(async () => {
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
      const db = await createTestDB(1)

      // Execute migration manually
      const tx = db.transaction([], 'readwrite')
      v1Migration.up(db, tx)

      // Verify stores exist
      const stores = Array.from(db.objectStoreNames)
      expect(stores).toContain('prices')
      expect(stores).toContain('history')
      expect(stores).toContain('preferences')

      db.close()
    })

    it('creates stores with correct keyPath', async () => {
      const db = await createTestDB(1)

      const tx = db.transaction([], 'readwrite')
      v1Migration.up(db, tx)

      const priceStore = db.transaction('prices', 'readonly').objectStore('prices')
      expect(priceStore.keyPath).toBe('key')

      db.close()
    })
  })

  describe('v2Migration', () => {
    it('creates pendingMutations store', async () => {
      const db = await createTestDB(1)

      // Execute v1 first
      const tx1 = db.transaction([], 'readwrite')
      v1Migration.up(db, tx1)

      // Then v2
      const tx2 = db.transaction([], 'readwrite')
      v2Migration.up(db, tx2)

      expect(db.objectStoreNames.contains('pendingMutations')).toBe(true)

      const mutationStore = db.transaction('pendingMutations', 'readonly').objectStore('pendingMutations')
      expect(mutationStore.keyPath).toBe('id')
      expect(mutationStore.autoIncrement).toBe(true)

      db.close()
    })

    it('can be rolled back', async () => {
      const db = await createTestDB(2)

      if (v2Migration.down) {
        const tx = db.transaction([], 'readwrite')
        v2Migration.down(db, tx)

        expect(db.objectStoreNames.contains('pendingMutations')).toBe(false)
      }

      db.close()
    })
  })

  describe('v3Migration', () => {
    it('adds indexes', async () => {
      const db = await createTestDB(2)

      // Execute v1 and v2 to create stores
      const tx1 = db.transaction([], 'readwrite')
      v1Migration.up(db, tx1)
      v2Migration.up(db, tx1)

      // Wait for transaction to complete
      await new Promise((resolve) => {
        tx1.oncomplete = resolve
      })

      // Then v3
      const tx2 = db.transaction(['history', 'pendingMutations'], 'readwrite')
      v3Migration.up(db, tx2)

      // Verify indexes
      const historyStore = db.transaction('history', 'readonly').objectStore('history')
      expect(historyStore.indexNames.contains('by-pair')).toBe(true)
      expect(historyStore.indexNames.contains('by-timestamp')).toBe(true)

      const mutationStore = db.transaction('pendingMutations', 'readonly').objectStore('pendingMutations')
      expect(mutationStore.indexNames.contains('by-timestamp')).toBe(true)

      db.close()
    })
  })

  describe('createAppMigrationRunner', () => {
    it('creates a migration runner with all migrations', () => {
      const runner = createAppMigrationRunner()
      expect(runner).toBeDefined()
    })

    it('can execute all migrations', async () => {
      const runner = createAppMigrationRunner()
      const db = await createTestDB(CURRENT_DB_VERSION)

      const applied = await runner.run(db, 0, CURRENT_DB_VERSION)

      expect(applied).toBe(3)

      // Verify all stores exist
      expect(db.objectStoreNames.contains('prices')).toBe(true)
      expect(db.objectStoreNames.contains('history')).toBe(true)
      expect(db.objectStoreNames.contains('preferences')).toBe(true)
      expect(db.objectStoreNames.contains('pendingMutations')).toBe(true)

      // Verify indexes
      const historyStore = db.transaction('history', 'readonly').objectStore('history')
      expect(historyStore.indexNames.contains('by-pair')).toBe(true)

      db.close()
    })

    it('records migration history', async () => {
      const runner = createAppMigrationRunner()
      const db = await createTestDB(CURRENT_DB_VERSION)

      await runner.run(db, 0, CURRENT_DB_VERSION)

      const history = await runner.getMigrationHistory(db)

      expect(history).toHaveLength(3)
      expect(history[0].name).toBe('initial-schema')
      expect(history[1].name).toBe('add-pending-mutations')
      expect(history[2].name).toBe('add-query-indexes')

      db.close()
    })
  })

  describe('Integration', () => {
    it('can progressively apply migrations', async () => {
      const runner = createAppMigrationRunner()

      // Start with v1
      const db = await createTestDB(1)
      await runner.run(db, 0, 1)

      let version = await runner.getCurrentVersion(db)
      expect(version).toBe(1)

      // Progress to v2
      await runner.run(db, 1, 2)
      version = await runner.getCurrentVersion(db)
      expect(version).toBe(2)
      expect(db.objectStoreNames.contains('pendingMutations')).toBe(true)

      // Progress to v3
      await runner.run(db, 2, 3)
      version = await runner.getCurrentVersion(db)
      expect(version).toBe(3)

      const historyStore = db.transaction('history', 'readonly').objectStore('history')
      expect(historyStore.indexNames.contains('by-pair')).toBe(true)

      db.close()
    })

    it('idempotently applies migrations', async () => {
      const runner = createAppMigrationRunner()
      const db = await createTestDB(CURRENT_DB_VERSION)

      // Apply migrations twice
      await runner.run(db, 0, CURRENT_DB_VERSION)
      const first = await runner.getMigrationHistory(db)

      // Clear migration history to simulate re-running
      const tx = db.transaction('__migrations__', 'readwrite')
      const store = tx.objectStore('__migrations__')
      await new Promise<void>((resolve) => {
        store.clear()
        tx.oncomplete = () => resolve()
      })

      // Run again - should not error
      await runner.run(db, 0, CURRENT_DB_VERSION)
      const second = await runner.getMigrationHistory(db)

      // Both should have same number of migrations
      expect(first).toHaveLength(3)
      expect(second).toHaveLength(3)

      db.close()
    })
  })
})
