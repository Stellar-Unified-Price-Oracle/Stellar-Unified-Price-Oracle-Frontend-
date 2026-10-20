import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { idbCache } from '../hooks/useIndexedDB'
import { offlinePriceStore } from '../services/offlinePriceStore'
import { STORAGE_KEYS, clearAllData, readRawResult, writeRaw } from './storage'

/**
 * A local-data deletion request is "complete" only when the app can show that
 * every owned record is gone. `readRawResult` distinguishes an absent key from
 * unavailable storage, so these tests check the positive evidence of deletion
 * rather than just the absence of an error.
 */
beforeEach(() => {
  localStorage.clear()
  idbCache._reset()
  idbCache._disableSyncQueue()
})

afterEach(() => {
  idbCache._reset()
})

describe('local-data deletion completion', () => {
  it('reports every owned localStorage key as present-and-empty after deletion', async () => {
    for (const key of Object.values(STORAGE_KEYS)) writeRaw(key, 'seeded')

    await clearAllData()

    for (const key of Object.values(STORAGE_KEYS)) {
      expect(readRawResult(key), key).toEqual({ available: true, value: null })
    }
  })

  it('empties the cached offline price snapshot', async () => {
    await idbCache.set('prices', 'offline-snapshot', { prices: [], savedAt: Date.now() })
    expect(await offlinePriceStore.load()).not.toBeNull()

    await clearAllData()

    expect(await offlinePriceStore.load()).toBeNull()
  })

  it('resolves only after the IndexedDB caches are empty', async () => {
    await idbCache.set('preferences', 'preferences', { theme: 'light' })

    await clearAllData()

    // The caller can treat the resolved promise as the completion signal.
    expect(await idbCache.get('preferences', 'preferences')).toBeNull()
  })

  it('completes safely when deletion is requested again', async () => {
    writeRaw(STORAGE_KEYS.alerts, 'seeded')
    await clearAllData()

    await expect(clearAllData()).resolves.toBeUndefined()
    expect(readRawResult(STORAGE_KEYS.alerts)).toEqual({ available: true, value: null })
  })
})
