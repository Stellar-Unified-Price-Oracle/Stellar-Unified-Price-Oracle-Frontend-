import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  MigrationError,
  MigrationRunner,
  DataTransformer,
  createMigrationRegistry,
  createMigrationRunner,
} from './idbMigrations'
import type { MigrationStep } from './idbMigrations'

// Test helpers
function createTestDB(name: string = 'test-db', version: number = 1): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function deleteTestDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

describe('MigrationRegistry', () => {
  it('registers migrations in order', () => {
    const registry = createMigrationRegistry()

    const m1: MigrationStep = {
      version: 1,
      name: 'test-v1',
      up: (db) => {
        db.createObjectStore('store1', { keyPath: 'id' })
      },
    }

    const m2: MigrationStep = {
      version: 2,
      name: 'test-v2',
      up: (db) => {
        db.createObjectStore('store2', { keyPath: 'id' })
      },
    }

    registry.register(1, m1)
    registry.register(2, m2)

    const all = registry.getAll()
    expect(all).toHaveLength(2)
    expect(all[0].version).toBe(1)
    expect(all[1].version).toBe(2)
  })

  it('throws on duplicate registration', () => {
    const registry = createMigrationRegistry()
    const migration: MigrationStep = {
      version: 1,
      name: 'test',
      up: () => {},
    }

    registry.register(1, migration)
    expect(() => registry.register(1, migration)).toThrow('Migration v1 already registered')
  })

  it('throws on invalid version', () => {
    const registry = createMigrationRegistry()
    const migration: MigrationStep = {
      version: 0,
      name: 'test',
      up: () => {},
    }

    expect(() => registry.register(0, migration)).toThrow('Migration versions must be >= 1')
  })

  it('returns migrations in range', () => {
    const registry = createMigrationRegistry()

    for (let i = 1; i <= 5; i++) {
      registry.register(i, {
        version: i,
        name: `test-v${i}`,
        up: () => {},
      })
    }

    const range = registry.getRange(1, 3)
    expect(range).toHaveLength(2)
    expect(range.map((m) => m.version)).toEqual([2, 3])
  })

  it('reports latest version', () => {
    const registry = createMigrationRegistry()

    registry.register(1, { version: 1, name: 'v1', up: () => {} })
    registry.register(3, { version: 3, name: 'v3', up: () => {} })
    registry.register(2, { version: 2, name: 'v2', up: () => {} })

    expect(registry.getLatestVersion()).toBe(3)
  })

  it('returns 0 for empty registry', () => {
    const registry = createMigrationRegistry()
    expect(registry.getLatestVersion()).toBe(0)
  })
})

describe('MigrationRunner', () => {
  let runner: MigrationRunner
  let db: IDBDatabase

  beforeEach(async () => {
    await deleteTestDB('migration-test')
    runner = createMigrationRunner(createMigrationRegistry())
  })

  afterEach(async () => {
    if (db) db.close()
    await deleteTestDB('migration-test')
  })

  it('reports 0 version for new database', async () => {
    db = await createTestDB('migration-test', 1)
    const version = await runner.getCurrentVersion(db)
    expect(version).toBe(0)
  })

  it('executes a single migration', async () => {
    const registry = createMigrationRegistry()
    const m1: MigrationStep = {
      version: 1,
      name: 'create-store',
      up: (db) => {
        if (!db.objectStoreNames.contains('test-store')) {
          db.createObjectStore('test-store', { keyPath: 'id' })
        }
      },
    }
    registry.register(1, m1)

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 1)

    const applied = await testRunner.run(db, 0, 1)

    expect(applied).toBe(1)
    expect(db.objectStoreNames.contains('test-store')).toBe(true)
  })

  it('executes multiple migrations in sequence', async () => {
    const registry = createMigrationRegistry()

    registry.register(1, {
      version: 1,
      name: 'create-store1',
      up: (db) => {
        db.createObjectStore('store1', { keyPath: 'id' })
      },
    })

    registry.register(2, {
      version: 2,
      name: 'create-store2',
      up: (db) => {
        db.createObjectStore('store2', { keyPath: 'id' })
      },
    })

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 2)

    const applied = await testRunner.run(db, 0, 2)

    expect(applied).toBe(2)
    expect(db.objectStoreNames.contains('store1')).toBe(true)
    expect(db.objectStoreNames.contains('store2')).toBe(true)
  })

  it('skips if already at target version', async () => {
    const registry = createMigrationRegistry()
    registry.register(1, {
      version: 1,
      name: 'test',
      up: (db) => {
        db.createObjectStore('store', { keyPath: 'id' })
      },
    })

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 1)

    const applied = await testRunner.run(db, 1, 1)

    expect(applied).toBe(0)
  })

  it('throws on backward migration', async () => {
    const registry = createMigrationRegistry()
    registry.register(1, { version: 1, name: 'test', up: () => {} })

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 1)

    await expect(testRunner.run(db, 3, 1)).rejects.toThrow(MigrationError)
  })

  it('throws when no migrations found', async () => {
    const registry = createMigrationRegistry()
    registry.register(3, { version: 3, name: 'test', up: () => {} })

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 1)

    await expect(testRunner.run(db, 1, 2)).rejects.toThrow(MigrationError)
  })

  it('records migrations in metadata store', async () => {
    const registry = createMigrationRegistry()
    registry.register(1, {
      version: 1,
      name: 'test-migration',
      description: 'A test migration',
      up: (db) => {
        db.createObjectStore('store', { keyPath: 'id' })
      },
    })

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 1)

    await testRunner.run(db, 0, 1)

    const history = await testRunner.getMigrationHistory(db)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      version: 1,
      name: 'test-migration',
      description: 'A test migration',
    })
    expect(history[0].appliedAt).toBeDefined()
  })

  it('gets empty history for new database', async () => {
    db = await createTestDB('migration-test', 1)
    const history = await runner.getMigrationHistory(db)
    expect(history).toEqual([])
  })

  it('maintains version order in history', async () => {
    const registry = createMigrationRegistry()

    for (let i = 1; i <= 3; i++) {
      registry.register(i, {
        version: i,
        name: `migration-${i}`,
        up: (db) => {
          db.createObjectStore(`store${i}`, { keyPath: 'id' })
        },
      })
    }

    const testRunner = createMigrationRunner(registry)
    db = await createTestDB('migration-test', 3)

    await testRunner.run(db, 0, 3)

    const history = await testRunner.getMigrationHistory(db)
    expect(history.map((m) => m.version)).toEqual([1, 2, 3])
  })
})

describe('MigrationError', () => {
  it('includes version and reason', () => {
    const original = new Error('Test error')
    const error = new MigrationError(5, 'execute', 'Migration failed', original)

    expect(error.version).toBe(5)
    expect(error.reason).toBe('execute')
    expect(error.originalError).toBe(original)
    expect(error.message).toContain('v5')
    expect(error.message).toContain('execute')
  })
})

describe('DataTransformer', () => {
  let db: IDBDatabase

  beforeEach(async () => {
    await deleteTestDB('transformer-test')
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('transformer-test', 1)
      req.onupgradeneeded = () => {
        const tx = req.transaction!
        tx.db.createObjectStore('test', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  })

  afterEach(async () => {
    if (db) db.close()
    await deleteTestDB('transformer-test')
  })

  it('renames properties', async () => {
    // Insert test data
    const tx = db.transaction('test', 'readwrite')
    const store = tx.objectStore('test')
    await new Promise<void>((resolve, reject) => {
      store.add({ id: 1, oldName: 'value' })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // Rename property
    const tx2 = db.transaction('test', 'readwrite')
    const store2 = tx2.objectStore('test')
    const count = await DataTransformer.renameProperty(store2, 'oldName', 'newName')

    expect(count).toBe(1)

    // Verify
    const tx3 = db.transaction('test', 'readonly')
    const store3 = tx3.objectStore('test')
    const result = await new Promise<any>((resolve, reject) => {
      const req = store3.get(1)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    expect(result.newName).toBe('value')
    expect(result.oldName).toBeUndefined()
  })

  it('transforms entries', async () => {
    // Insert test data
    const tx = db.transaction('test', 'readwrite')
    const store = tx.objectStore('test')
    await new Promise<void>((resolve, reject) => {
      store.add({ id: 1, value: 10 })
      store.add({ id: 2, value: 20 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // Transform entries
    const tx2 = db.transaction('test', 'readwrite')
    const store2 = tx2.objectStore('test')
    const count = await DataTransformer.transformAll(store2, (entry: any) => ({
      ...entry,
      value: entry.value * 2,
    }))

    expect(count).toBe(2)

    // Verify
    const tx3 = db.transaction('test', 'readonly')
    const store3 = tx3.objectStore('test')
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store3.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    expect(results[0].value).toBe(20)
    expect(results[1].value).toBe(40)
  })

  it('creates indexes safely', async () => {
    const tx = db.transaction('test', 'readwrite')
    const store = tx.objectStore('test')

    DataTransformer.createIndex(store, 'idx1', 'field1')
    DataTransformer.createIndex(store, 'idx1', 'field1') // Should not throw

    expect(store.indexNames.contains('idx1')).toBe(true)
  })

  it('deletes entries matching predicate', async () => {
    // Insert test data
    const tx = db.transaction('test', 'readwrite')
    const store = tx.objectStore('test')
    await new Promise<void>((resolve, reject) => {
      store.add({ id: 1, keep: true })
      store.add({ id: 2, keep: false })
      store.add({ id: 3, keep: true })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // Delete where keep === false
    const tx2 = db.transaction('test', 'readwrite')
    const store2 = tx2.objectStore('test')
    const count = await DataTransformer.deleteWhere(store2, (entry: any) => !entry.keep)

    expect(count).toBe(1)

    // Verify
    const tx3 = db.transaction('test', 'readonly')
    const store3 = tx3.objectStore('test')
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store3.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    expect(results).toHaveLength(2)
    expect(results.map((r) => r.id)).toEqual([1, 3])
  })

  it('bulk inserts entries', async () => {
    const tx = db.transaction('test', 'readwrite')
    const store = tx.objectStore('test')

    const count = await DataTransformer.bulkInsert(store, [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ])

    expect(count).toBe(3)

    // Verify
    const tx2 = db.transaction('test', 'readonly')
    const store2 = tx2.objectStore('test')
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store2.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    expect(results).toHaveLength(3)
  })
})
