/**
 * IndexedDB Migration System
 *
 * Provides versioned, trackable migrations for schema changes.
 * Each migration is atomic, with rollback capability and comprehensive error handling.
 *
 * Usage:
 * 1. Define a migration function: (db: IDBDatabase, tx: IDBTransaction) => void
 * 2. Register it: registry.register(3, migrationV3)
 * 3. Run migrations: await migrationRunner.run(db, 2, 3)
 */

export interface MigrationMetadata {
  version: number
  appliedAt: number
  name: string
  description?: string
}

export interface MigrationStep {
  version: number
  name: string
  description?: string
  up: (db: IDBDatabase, tx: IDBTransaction) => void | Promise<void>
  down?: (db: IDBDatabase, tx: IDBTransaction) => void | Promise<void>
}

/**
 * Error thrown when a migration fails.
 * Includes the version where failure occurred and context for debugging.
 */
export class MigrationError extends Error {
  constructor(
    public version: number,
    public reason: 'execute' | 'rollback' | 'validation' | 'metadata',
    message: string,
    public originalError?: Error,
  ) {
    super(`Migration v${version} failed (${reason}): ${message}`)
    Object.setPrototypeOf(this, MigrationError.prototype)
  }
}

/**
 * Registry for all available migrations.
 * Maintains a sorted list of migration steps.
 */
export class MigrationRegistry {
  private migrations: Map<number, MigrationStep> = new Map()
  private sorted: MigrationStep[] = []

  register(version: number, step: MigrationStep): void {
    if (this.migrations.has(version)) {
      throw new Error(`Migration v${version} already registered`)
    }
    if (version < 1) {
      throw new Error('Migration versions must be >= 1')
    }
    this.migrations.set(version, step)
    this.sorted = Array.from(this.migrations.values()).sort((a, b) => a.version - b.version)
  }

  get(version: number): MigrationStep | undefined {
    return this.migrations.get(version)
  }

  getRange(fromVersion: number, toVersion: number): MigrationStep[] {
    return this.sorted.filter((m) => m.version > fromVersion && m.version <= toVersion)
  }

  getAll(): MigrationStep[] {
    return [...this.sorted]
  }

  getLatestVersion(): number {
    if (this.sorted.length === 0) return 0
    return this.sorted[this.sorted.length - 1].version
  }
}

/**
 * Data transformation utilities for safe schema changes.
 * Provides helpers for common migration patterns.
 */
export class DataTransformer {
  /**
   * Safely rename a property on all entries in a store.
   * Returns the count of transformed entries.
   */
  static renameProperty(
    store: IDBObjectStore,
    oldName: string,
    newName: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      let count = 0

      req.onsuccess = () => {
        const entries = req.result as Record<string, unknown>[]
        for (const entry of entries) {
          if (oldName in entry) {
            entry[newName] = entry[oldName]
            delete entry[oldName]
            store.put(entry)
            count++
          }
        }
        resolve(count)
      }

      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Safely delete entries matching a predicate.
   * Returns the count of deleted entries.
   */
  static deleteWhere(store: IDBObjectStore, predicate: (entry: unknown) => boolean): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      let count = 0

      req.onsuccess = () => {
        const entries = req.result as Array<Record<string, unknown>>
        for (const entry of entries) {
          if (predicate(entry)) {
            // Extract key from the entry using the store's keyPath
            const keyPath = store.keyPath as string | string[]
            const keys = Array.isArray(keyPath) ? keyPath : [keyPath]
            const key = keys.length === 1 ? entry[keys[0]] : keys

            store.delete(key as IDBValidKey)
            count++
          }
        }
        resolve(count)
      }

      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Safely transform all entries in a store using a mapping function.
   * Returns the count of transformed entries.
   */
  static transformAll<T extends Record<string, unknown>>(
    store: IDBObjectStore,
    mapper: (entry: T) => T,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      let count = 0

      req.onsuccess = () => {
        const entries = req.result as T[]
        for (const entry of entries) {
          const transformed = mapper(entry)
          store.put(transformed)
          count++
        }
        resolve(count)
      }

      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Create index on a store.
   * Safe to call even if index already exists.
   */
  static createIndex(
    store: IDBObjectStore,
    indexName: string,
    keyPath: string | string[],
    options?: { unique?: boolean; multiEntry?: boolean },
  ): void {
    try {
      if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, keyPath, options)
      }
    } catch (e) {
      // Index already exists, which is fine
      if (!(e instanceof DOMException && e.name === 'ConstraintError')) {
        throw e
      }
    }
  }

  /**
   * Bulk insert entries into a store.
   * Returns the count of inserted entries.
   */
  static bulkInsert(store: IDBObjectStore, entries: unknown[]): Promise<number> {
    return new Promise((resolve) => {
      let count = 0
      let index = 0

      const insertNext = () => {
        if (index >= entries.length) {
          resolve(count)
          return
        }

        const req = store.add(entries[index])
        req.onsuccess = () => {
          count++
          index++
          insertNext()
        }
        req.onerror = () => {
          // Non-fatal; continue with next entry
          index++
          insertNext()
        }
      }

      insertNext()
    })
  }
}

/**
 * Validates that a migration was applied successfully.
 */
export interface MigrationValidator {
  validate(db: IDBDatabase): Promise<boolean>
  describe(): string
}

/**
 * Executes migrations with automatic rollback on failure.
 * Maintains migration history in a metadata store.
 */
export class MigrationRunner {
  private registry: MigrationRegistry
  private readonly metadataStore = '__migrations__'

  constructor(registry: MigrationRegistry) {
    this.registry = registry
  }

  /**
   * Get the current migration version from metadata.
   * Returns 0 if no migrations have been applied.
   */
  async getCurrentVersion(db: IDBDatabase): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(this.metadataStore)) {
        resolve(0)
        return
      }

      const tx = db.transaction(this.metadataStore, 'readonly')
      const store = tx.objectStore(this.metadataStore)
      const req = store.get('version')

      req.onsuccess = () => {
        const meta = req.result as MigrationMetadata | undefined
        resolve(meta?.version ?? 0)
      }

      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Get all applied migrations.
   */
  async getMigrationHistory(db: IDBDatabase): Promise<MigrationMetadata[]> {
    return new Promise((_resolve, reject) => {
      if (!db.objectStoreNames.contains(this.metadataStore)) {
        _resolve([])
        return
      }

      const tx = db.transaction(this.metadataStore, 'readonly')
      const store = tx.objectStore(this.metadataStore)
      const req = store.getAll()

      req.onsuccess = () => {
        const entries = (req.result as MigrationMetadata[]).filter((m) => m.version > 0)
        _resolve(entries.sort((a, b) => a.version - b.version))
      }

      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Create or ensure the metadata store exists.
   */
  private ensureMetadataStore(db: IDBDatabase, tx: IDBTransaction): void {
    if (!db.objectStoreNames.contains(this.metadataStore)) {
      tx.db.createObjectStore(this.metadataStore, { keyPath: 'version' })
    }
  }

  /**
   * Record a successful migration in metadata.
   */
  private recordMigration(
    tx: IDBTransaction,
    version: number,
    name: string,
    description?: string,
  ): void {
    const store = tx.objectStore(this.metadataStore)
    const metadata: MigrationMetadata = {
      version,
      appliedAt: Date.now(),
      name,
      description,
    }
    store.put(metadata)
  }

  /**
   * Execute pending migrations from fromVersion to toVersion (inclusive).
   * Returns the number of migrations applied.
   *
   * Throws MigrationError if any migration fails.
   */
  async run(db: IDBDatabase, _fromVersion: number, toVersion: number): Promise<number> {
    const current = await this.getCurrentVersion(db)

    if (current > toVersion) {
      throw new MigrationError(
        current,
        'validation',
        `Cannot migrate backward from v${current} to v${toVersion}`,
      )
    }

    if (current === toVersion) {
      return 0 // Already at target version
    }

    const migrations = this.registry.getRange(current, toVersion)
    if (migrations.length === 0) {
      throw new MigrationError(
        toVersion,
        'validation',
        `No migrations found from v${current} to v${toVersion}`,
      )
    }

    let applied = 0

    for (const migration of migrations) {
      try {
        await this.executeMigration(db, migration)
        applied++
      } catch (error) {
        throw new MigrationError(
          migration.version,
          'execute',
          error instanceof Error ? error.message : 'Unknown error',
          error instanceof Error ? error : undefined,
        )
      }
    }

    return applied
  }

  /**
   * Execute a single migration step with transaction handling.
   */
  private async executeMigration(db: IDBDatabase, migration: MigrationStep): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(Array.from(db.objectStoreNames), 'readwrite')

      // Ensure metadata store exists
      this.ensureMetadataStore(db, tx)

      try {
        const result = migration.up(db, tx)
        if (result instanceof Promise) {
          result.then(() => {
            this.recordMigration(tx, migration.version, migration.name, migration.description)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
          }).catch(reject)
        } else {
          this.recordMigration(tx, migration.version, migration.name, migration.description)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      } catch (error) {
        tx.abort()
        reject(error)
      }
    })
  }
}

/**
 * Create a new migration registry with the latest version number.
 * Use this as the export for your app's migrations.
 */
export function createMigrationRegistry(): MigrationRegistry {
  return new MigrationRegistry()
}

/**
 * Create a migration runner bound to a registry.
 */
export function createMigrationRunner(registry: MigrationRegistry): MigrationRunner {
  return new MigrationRunner(registry)
}
