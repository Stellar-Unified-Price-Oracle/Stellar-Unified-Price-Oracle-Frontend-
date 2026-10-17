import { describe, expect, it } from 'vitest'
import { STORAGE_INVENTORY, STORAGE_KEYS } from './storage'

/**
 * The inventory is the user-facing record of what this app keeps on the device.
 * These tests keep it honest: every registered key is documented, every entry
 * states its privacy class, and nothing is listed twice.
 */
describe('storage inventory', () => {
  const documentedKeys = STORAGE_INVENTORY.localStorage.map((entry) => entry.key)

  it('documents only keys the app actually registers', () => {
    // A documented key with no registration would describe data the app never writes.
    const registered = new Set<string>(Object.values(STORAGE_KEYS))
    for (const key of documentedKeys) {
      expect(registered.has(key), key).toBe(true)
    }
  })

  it('lists each localStorage key exactly once', () => {
    expect(new Set(documentedKeys).size).toBe(documentedKeys.length)
  })

  it('gives every localStorage entry a non-empty description', () => {
    for (const entry of STORAGE_INVENTORY.localStorage) {
      expect(entry.description.trim().length, entry.key).toBeGreaterThan(0)
    }
  })

  it('states the privacy class of every localStorage entry', () => {
    // Each description must say whether it holds personal data, so a user can read the policy per item.
    for (const entry of STORAGE_INVENTORY.localStorage) {
      expect(entry.description, entry.key).toMatch(/No PII|NOT persisted/)
    }
  })

  it('does not claim to persist a secret', () => {
    // Any entry that mentions a credential must say it is kept out of storage.
    for (const entry of STORAGE_INVENTORY.localStorage) {
      if (/secret|token|password/i.test(entry.description)) {
        expect(entry.description, entry.key).toMatch(/NOT persisted|no secrets/)
      }
    }
  })

  it('documents each IndexedDB store once with a positive TTL and a description', () => {
    const stores = STORAGE_INVENTORY.indexedDB.map((entry) => entry.store)
    expect(new Set(stores).size).toBe(stores.length)
    for (const entry of STORAGE_INVENTORY.indexedDB) {
      expect(entry.ttlMs, entry.store).toBeGreaterThan(0)
      expect(entry.description.trim().length, entry.store).toBeGreaterThan(0)
    }
  })

  it('states the expiry policy for the cache stores that expire', () => {
    const cache = STORAGE_INVENTORY.indexedDB.filter((entry) => Number.isFinite(entry.ttlMs))
    expect(cache.map((entry) => entry.store).sort()).toEqual(['history', 'prices'])
    for (const entry of cache) {
      expect(entry.ttlMs).toBe(5 * 60 * 1000)
    }
    expect(cache.find((entry) => entry.store === 'prices')?.description).toMatch(/5 min/)
    expect(cache.find((entry) => entry.store === 'history')?.description).toMatch(/Same policy as prices/)
  })
})
