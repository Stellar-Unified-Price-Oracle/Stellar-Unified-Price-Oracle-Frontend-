# IndexedDB Migration Strategy

## Overview

The Stellar Oracle frontend uses a **versioned migration system** for IndexedDB schema changes. This ensures:

- **Schema versioning**: Each database change is tracked by version number
- **Safe upgrades**: Migrations run atomically within transactions
- **Data safety**: Comprehensive error handling prevents data loss
- **Auditability**: Migration history is tracked in the database metadata store
- **Backward compatibility**: Version checks prevent incompatible upgrades

## Architecture

### Key Components

**`idbMigrations.ts`** — Core migration framework
- `MigrationRegistry`: Registers and manages versioned migrations
- `MigrationRunner`: Executes migrations with transaction safety
- `DataTransformer`: Utilities for safe schema transformations
- `MigrationError`: Specific error type for debugging

**`idbMigrationDefinitions.ts`** — App-specific migrations
- `v1Migration`, `v2Migration`, `v3Migration`: Current migrations
- `createAppMigrationRegistry()`: Factory to instantiate the app's migrations
- `CURRENT_DB_VERSION`: The target version (currently 3)

**`useIndexedDB.ts`** — Cache layer integration
- Uses `CURRENT_DB_VERSION` from migration definitions
- Automatically runs pending migrations when the database opens
- All migrations versioned and tracked

## Current Schema

### Version History

| Version | Migration | Stores Affected | Purpose |
|---------|-----------|-----------------|---------|
| 1 | `initial-schema` | prices, history, preferences | Create core stores |
| 2 | `add-pending-mutations` | pendingMutations | Add offline sync queue |
| 3 | `add-query-indexes` | history, pendingMutations | Add indexes for queries |

### Version 3 Schema

```
Database: stellar-oracle (v3)

Stores:
├── prices
│   ├── keyPath: 'key' (assetPair)
│   ├── CacheEntry<PriceData>
│   └── TTL: 5 minutes
├── history
│   ├── keyPath: 'key' (pair:timestamp)
│   ├── CacheEntry<PriceHistory>
│   ├── Index: by-pair (pair)
│   ├── Index: by-timestamp (timestamp)
│   └── TTL: Varies (chart data retention)
├── preferences
│   ├── keyPath: 'key'
│   └── CacheEntry<Preferences>
├── pendingMutations
│   ├── keyPath: 'id' (auto-increment)
│   ├── MigrationMetadata
│   ├── Index: by-timestamp (timestamp)
│   └── Offline sync queue
└── __migrations__ (metadata)
    ├── keyPath: 'version'
    └── MigrationMetadata[] (applied migrations)
```

## How Migrations Work

### 1. Database Opens

When `useIndexedDB.ts` calls `indexedDB.open()`:

```typescript
const req = indexedDB.open('stellar-oracle', 3) // 3 = CURRENT_DB_VERSION
```

### 2. onupgradeneeded Handler Triggers

If the browser has an older version (or no database), `onupgradeneeded` fires:

```typescript
req.onupgradeneeded = async () => {
  const runner = getMigrationRunner()
  const currentVersion = await runner.getCurrentVersion(db)
  await runner.run(db, currentVersion, DB_VERSION)
}
```

### 3. MigrationRunner Executes Pending Migrations

For each migration from `currentVersion + 1` to `DB_VERSION`:

1. Executes the migration's `up()` function within a transaction
2. Tracks the migration in `__migrations__` metadata store
3. Throws `MigrationError` if any step fails
4. Transaction rolls back on failure (database left in consistent state)

### 4. Migration History Tracked

In `__migrations__` store:

```typescript
{
  version: 1,
  appliedAt: 1693012345000,
  name: 'initial-schema',
  description: 'Create prices, history, and preferences stores'
}
```

## Adding a New Migration

### Step 1: Create the Migration Function

In `idbMigrationDefinitions.ts`:

```typescript
/**
 * v4: Add alertThresholds store for persistence
 */
export const v4Migration: MigrationStep = {
  version: 4,
  name: 'add-alerts-store',
  description: 'Add store for persisting alert thresholds',
  up: (db) => {
    if (!db.objectStoreNames.contains('alertThresholds')) {
      db.createObjectStore('alertThresholds', { keyPath: 'id' })
    }
  },
  down: (db) => {
    if (db.objectStoreNames.contains('alertThresholds')) {
      db.deleteObjectStore('alertThresholds')
    }
  },
}
```

### Step 2: Register the Migration

```typescript
export function createAppMigrationRegistry() {
  const registry = createMigrationRegistry()
  registry.register(1, v1Migration)
  registry.register(2, v2Migration)
  registry.register(3, v3Migration)
  registry.register(4, v4Migration)  // Add here
  return registry
}
```

### Step 3: Update CURRENT_DB_VERSION

```typescript
export const CURRENT_DB_VERSION = 4
```

### Step 4: Test the Migration

See [Testing Migrations](#testing-migrations) below.

## Common Migration Patterns

### Creating a Store

```typescript
export const v2Migration: MigrationStep = {
  version: 2,
  name: 'add-pending-mutations',
  up: (db) => {
    if (!db.objectStoreNames.contains('pendingMutations')) {
      db.createObjectStore('pendingMutations', { keyPath: 'id', autoIncrement: true })
    }
  },
}
```

### Adding Indexes

```typescript
export const v3Migration: MigrationStep = {
  version: 3,
  name: 'add-query-indexes',
  up: (_, tx) => {
    const store = tx.objectStore('history')
    DataTransformer.createIndex(store, 'by-pair', 'pair')
    DataTransformer.createIndex(store, 'by-timestamp', 'timestamp')
  },
}
```

### Transforming Data

```typescript
export const v4Migration: MigrationStep = {
  version: 4,
  name: 'normalize-cache-entries',
  up: (_, tx) => {
    const store = tx.objectStore('prices')
    DataTransformer.transformAll(store, (entry) => ({
      ...entry,
      // Add new required fields with defaults
      version: entry.version || 1,
      expiresAt: entry.expiresAt || Date.now() + 5 * 60 * 1000,
    }))
  },
}
```

### Renaming Fields

```typescript
export const v5Migration: MigrationStep = {
  version: 5,
  name: 'rename-price-fields',
  up: (_, tx) => {
    const store = tx.objectStore('prices')
    DataTransformer.renameProperty(store, 'updatedAt', 'accessedAt')
  },
}
```

### Deleting Old Data

```typescript
export const v6Migration: MigrationStep = {
  version: 6,
  name: 'cleanup-stale-history',
  up: (_, tx) => {
    const store = tx.objectStore('history')
    const maxAge = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
    DataTransformer.deleteWhere(store, (entry: any) => entry.storedAt < maxAge)
  },
}
```

## DataTransformer Utilities

All utilities are **non-fatal** and won't break the migration:

### renameProperty(store, oldName, newName)

Safely rename a property on all entries. Returns count of transformed entries.

```typescript
DataTransformer.renameProperty(store, 'updatedAt', 'accessedAt')
```

### deleteWhere(store, predicate)

Delete entries matching a condition. Returns count of deleted entries.

```typescript
DataTransformer.deleteWhere(store, (entry: any) => !entry.isValid)
```

### transformAll(store, mapper)

Transform all entries in a store. Returns count of transformed entries.

```typescript
DataTransformer.transformAll(store, (entry) => ({
  ...entry,
  newField: 'default-value',
}))
```

### createIndex(store, indexName, keyPath, options)

Create an index on a store. Safe to call even if index exists.

```typescript
DataTransformer.createIndex(store, 'by-timestamp', 'timestamp')
DataTransformer.createIndex(store, 'unique-ids', 'id', { unique: true })
```

### bulkInsert(store, entries)

Bulk insert entries into a store. Returns count of inserted entries.

```typescript
DataTransformer.bulkInsert(store, [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
])
```

## Error Handling

### MigrationError

Thrown when a migration fails. Contains:

```typescript
class MigrationError extends Error {
  version: number         // Which version failed
  reason: string          // 'execute' | 'rollback' | 'validation' | 'metadata'
  originalError?: Error   // The underlying error
}
```

### Catching Migration Errors

```typescript
try {
  await runner.run(db, currentVersion, targetVersion)
} catch (error) {
  if (error instanceof MigrationError) {
    console.error(`Migration v${error.version} failed:`, error.message)
    // Transaction automatically rolled back
    // Database left in previous version state
  }
}
```

## Getting Migration Information

### Check Current Version

```typescript
const runner = getMigrationRunner()
const currentVersion = await runner.getCurrentVersion(db)
console.log(`Database at version ${currentVersion}`)
```

### Get Migration History

```typescript
const history = await runner.getMigrationHistory(db)
history.forEach(m => {
  console.log(`v${m.version}: ${m.name} applied at ${new Date(m.appliedAt)}`)
})
```

## Testing Migrations

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { MigrationRunner, MigrationRegistry } from '../utils/idbMigrations'
import { v4Migration } from '../utils/idbMigrationDefinitions'

describe('v4 Migration', () => {
  let db: IDBDatabase

  beforeEach(async () => {
    // Open database at v3
    db = await openTestDB(3)
  })

  it('creates alertThresholds store', async () => {
    const runner = new MigrationRunner(createRegistry([v4Migration]))
    await runner.run(db, 3, 4)
    
    expect(db.objectStoreNames.contains('alertThresholds')).toBe(true)
  })

  it('tracks migration in metadata', async () => {
    const runner = new MigrationRunner(createRegistry([v4Migration]))
    await runner.run(db, 3, 4)
    
    const history = await runner.getMigrationHistory(db)
    expect(history).toContainEqual(
      expect.objectContaining({
        version: 4,
        name: 'add-alerts-store',
      })
    )
  })
})
```

### Manual Testing

1. Open browser DevTools → Application → IndexedDB
2. Inspect the `__migrations__` store to see applied migrations
3. Verify schema by expanding the `stellar-oracle` database
4. Check for version number in idb: `db.version`

## Best Practices

### DO

✅ **Do:** Create one migration per schema change  
✅ **Do:** Include a `description` explaining the change  
✅ **Do:** Use `DataTransformer` for complex data changes  
✅ **Do:** Implement `down()` for destructive operations  
✅ **Do:** Test migrations with sample data  
✅ **Do:** Update `CURRENT_DB_VERSION` when adding migrations  
✅ **Do:** Keep migrations idempotent (safe to re-run)  

### DON'T

❌ **Don't:** Skip versions (always increment by 1)  
❌ **Don't:** Modify existing migration code (create a new one)  
❌ **Don't:** Assume data structures remain unchanged  
❌ **Don't:** Use async/await without returning Promise  
❌ **Don't:** Catch and silently ignore errors in migrations  

## Troubleshooting

### Migration Fails with "Cannot Find Store"

**Cause:** Migration tries to access a store that doesn't exist yet.

**Fix:** Create the store first or check `objectStoreNames`:

```typescript
up: (db) => {
  if (!db.objectStoreNames.contains('myStore')) {
    db.createObjectStore('myStore', { keyPath: 'id' })
  }
}
```

### Database Stuck at Old Version

**Cause:** Previous migration failed or was interrupted.

**Fix:** Check browser console for `MigrationError`. If safe, manually clear the database and let it reinitialize:

```javascript
// In DevTools console
indexedDB.deleteDatabase('stellar-oracle')
// Then reload page to recreate
```

### Migration Incomplete After Refresh

**Cause:** Browser closed during migration (rare).

**Fix:** Migrations are idempotent, so simply reload the page. The migration will resume.

### Need to Rollback a Migration

**Cause:** New migration has a bug and must be rolled back.

**Fix:** Implement a `down()` function in the migration, then:

1. Decrement `CURRENT_DB_VERSION`
2. Unregister the buggy migration
3. Users' databases will stay at the previous version
4. Deploy a new migration to fix the issue

## References

- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [IDB Spec](https://w3c.github.io/IndexedDB/)
- [Stellar Oracle Frontend Architecture](../docs)
