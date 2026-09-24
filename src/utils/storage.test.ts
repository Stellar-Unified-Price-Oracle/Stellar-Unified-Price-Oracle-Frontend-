import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { idbCache } from '../hooks/useIndexedDB'
import { STORAGE_KEYS, clearAllData, readJson, readRaw, remove, writeJson, writeRaw } from './storage'

beforeEach(() => {
  localStorage.clear()
  idbCache._reset()
  idbCache._disableSyncQueue()
  vi.clearAllMocks()
})

afterEach(() => {
  idbCache._reset()
  vi.restoreAllMocks()
})

describe('readRaw / writeRaw', () => {
  it('round-trips a string', () => {
    writeRaw(STORAGE_KEYS.analyticsOptOut, '1')
    expect(readRaw(STORAGE_KEYS.analyticsOptOut)).toBe('1')
  })

  it('returns null for an absent key', () => {
    expect(readRaw(STORAGE_KEYS.analyticsOptOut)).toBeNull()
  })

  it('returns null instead of throwing when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readRaw(STORAGE_KEYS.theme)).toBeNull()
  })

  it('swallows write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeRaw(STORAGE_KEYS.theme, 'dark')).not.toThrow()
  })
})

describe('readJson / writeJson', () => {
  it('round-trips a value', () => {
    writeJson(STORAGE_KEYS.alerts, [{ id: 'a' }])
    expect(readJson(STORAGE_KEYS.alerts, [])).toEqual([{ id: 'a' }])
  })

  it('falls back when the key is absent', () => {
    expect(readJson(STORAGE_KEYS.alerts, ['fallback'])).toEqual(['fallback'])
  })

  it('falls back on malformed JSON rather than throwing', () => {
    writeRaw(STORAGE_KEYS.alerts, '{not json')
    expect(readJson(STORAGE_KEYS.alerts, [])).toEqual([])
  })

  it('falls back when the validator rejects the parsed shape', () => {
    writeJson(STORAGE_KEYS.alerts, { nope: true })
    const isArray = (v: unknown): v is string[] => Array.isArray(v)
    expect(readJson(STORAGE_KEYS.alerts, ['fallback'], isArray)).toEqual(['fallback'])
  })

  it('accepts values the validator approves', () => {
    writeJson(STORAGE_KEYS.alerts, ['ok'])
    const isArray = (v: unknown): v is string[] => Array.isArray(v)
    expect(readJson(STORAGE_KEYS.alerts, [], isArray)).toEqual(['ok'])
  })
})

describe('remove', () => {
  it('deletes a single key', () => {
    writeRaw(STORAGE_KEYS.theme, 'dark')
    remove(STORAGE_KEYS.theme)
    expect(readRaw(STORAGE_KEYS.theme)).toBeNull()
  })
})

describe('clearAllData', () => {
  it('removes every registered key', async () => {
    for (const key of Object.values(STORAGE_KEYS)) writeRaw(key, 'x')

    await clearAllData()

    for (const key of Object.values(STORAGE_KEYS)) {
      expect(readRaw(key)).toBeNull()
    }
  })

  it('leaves keys the app does not own alone', async () => {
    localStorage.setItem('unrelated-third-party-key', 'keep me')
    await clearAllData()
    expect(localStorage.getItem('unrelated-third-party-key')).toBe('keep me')
  })

  it('clears the IndexedDB caches', async () => {
    // Seed the same stores clearAllData owns, then verify they are emptied.
    await idbCache.set('prices', 'btc', { price: 50000 })
    await idbCache.set('history', 'btc:123', { points: [1, 2] })
    await idbCache.set('preferences', 'preferences', { theme: 'dark' })

    await clearAllData()

    expect(await idbCache.get('prices', 'btc')).toBeNull()
    expect(await idbCache.get('history', 'btc:123')).toBeNull()
    expect(await idbCache.get('preferences', 'preferences')).toBeNull()
  })
})

describe('storage policy', () => {
  it('registers only non-sensitive keys', () => {
    // Guards against a token/secret/credential key being added without review.
    const forbidden = /token|secret|password|credential|apikey|api_key|session|auth/i
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key).not.toMatch(forbidden)
    }
  })
})
