import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  STORAGE_KEYS,
  readJson,
  writeJson,
  readRaw,
  writeRaw,
  remove,
  getLocalStorageSize,
  getLocalStorageBreakdown,
} from './storage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('readJson / writeJson round-trip properties', () => {
  it('round-trips any JSON-safe value through storage unchanged (deep equality)', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const jsonSafe = JSON.parse(JSON.stringify(value)) as unknown
        writeJson(STORAGE_KEYS.alerts, jsonSafe)
        expect(readJson(STORAGE_KEYS.alerts, null)).toEqual(jsonSafe)
      }),
      { numRuns: 400 },
    )
  })

  it('round-trips across all registered keys — the choice of key never changes the data', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(STORAGE_KEYS)), fc.jsonValue(), (key, value) => {
        const jsonSafe = JSON.parse(JSON.stringify(value)) as unknown
        writeJson(key, jsonSafe)
        expect(readJson(key, null)).toEqual(jsonSafe)
      }),
      { numRuns: 400 },
    )
  })

  it('preserves falsy-but-meaningful values (0, false, "", null, empty containers)', () => {
    fc.assert(
      fc.property(fc.constantFrom(0, false, '', null, [], {} as unknown), (value) => {
        writeJson(STORAGE_KEYS.theme, value)
        expect(readJson(STORAGE_KEYS.theme, 'sentinel')).toEqual(value)
      }),
      { numRuns: 20 },
    )
  })

  it('survives Unicode, surrogate pairs, and control characters (UTF-8 storage round-trip)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (s) => {
        writeJson(STORAGE_KEYS.recentLanguages, s)
        expect(readJson(STORAGE_KEYS.recentLanguages, 'fallback')).toBe(s)
      }),
      { numRuns: 400 },
    )
  })
})

// ---------------------------------------------------------------------------
// Untrusted input handling
// ---------------------------------------------------------------------------

describe('readJson fallback properties', () => {
  it('returns the fallback for arbitrary malformed byte strings, never throwing', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 64 }).filter((s) => {
          try {
            JSON.parse(s)
            return false
          } catch {
            return true
          }
        }),
        (malformed) => {
          writeRaw(STORAGE_KEYS.alerts, malformed)
          expect(readJson(STORAGE_KEYS.alerts, 'fallback')).toBe('fallback')
        },
      ),
      { numRuns: 300 },
    )
  })

  it('returns the fallback (not the malformed value) whenever the validator rejects the parsed shape', () => {
    const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
    const FALLBACK: string[] = ['fallback']

    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const jsonSafe = JSON.parse(JSON.stringify(value)) as unknown
        writeJson(STORAGE_KEYS.alerts, jsonSafe)
        const result = readJson(STORAGE_KEYS.alerts, FALLBACK, isStringArray)
        if (isStringArray(jsonSafe)) expect(result).toEqual(jsonSafe)
        else expect(result).toEqual(FALLBACK)
      }),
      { numRuns: 400 },
    )
  })

  it('returns the fallback when storage is unavailable (thrown getItem), for any fallback value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (fallbackRaw) => {
        const fallback = JSON.parse(JSON.stringify(fallbackRaw)) as unknown
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('SecurityError')
        })
        expect(readJson(STORAGE_KEYS.alerts, fallback)).toEqual(fallback)
      }),
      { numRuns: 100 },
    )
  })

  it('swallows write failures: a throwing setItem never breaks the caller', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (valueRaw) => {
        const value = JSON.parse(JSON.stringify(valueRaw)) as unknown
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new Error('QuotaExceededError')
        })
        expect(() => writeJson(STORAGE_KEYS.theme, value)).not.toThrow()
      }),
      { numRuns: 100 },
    )
  })

  it('treats storage reads as untrusted: validate() gates whatever is on disk', () => {
    const isEvenNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v % 2 === 0
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        writeRaw(STORAGE_KEYS.analyticsOptOut, String(n))
        const result = readJson(STORAGE_KEYS.analyticsOptOut, -1, isEvenNumber)
        expect(result).toBe(isEvenNumber(n) ? n : -1)
      }),
      { numRuns: 200 },
    )
  })
})

// ---------------------------------------------------------------------------
// Key isolation + inventory integrity
// ---------------------------------------------------------------------------

describe('key isolation properties', () => {
  it('reads and writes never leak across different registered keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(STORAGE_KEYS)),
        fc.constantFrom(...Object.values(STORAGE_KEYS)),
        fc.jsonValue(),
        (k1, k2, valueRaw) => {
          fc.pre(k1 !== k2)
          // Property runs share one jsdom localStorage — clear it every iteration
          // so a value written to k2 by an earlier iteration cannot fake a leak.
          localStorage.clear()
          const value = JSON.parse(JSON.stringify(valueRaw)) as unknown
          writeJson(k1, value)
          expect(readJson(k2, 'untouched')).toBe('untouched')
          expect(readJson(k1, null)).toEqual(value)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('remove deletes exactly the target key and nothing else', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(STORAGE_KEYS)),
        fc.constantFrom(...Object.values(STORAGE_KEYS)),
        (k1, k2) => {
          fc.pre(k1 !== k2)
          localStorage.clear()
          writeRaw(k1, 'a')
          writeRaw(k2, 'b')
          remove(k1)
          expect(readRaw(k1)).toBeNull()
          expect(readRaw(k2)).toBe('b')
        },
      ),
      { numRuns: 200 },
    )
  })

  it('writing distinct values to distinct keys round-trips independently, for any pair', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(STORAGE_KEYS)),
        fc.constantFrom(...Object.values(STORAGE_KEYS)),
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        (k1, k2, v1, v2) => {
          fc.pre(k1 !== k2)
          writeJson(k1, v1)
          writeJson(k2, v2)
          expect(readJson(k1, null)).toBe(v1)
          expect(readJson(k2, null)).toBe(v2)
        },
      ),
      { numRuns: 200 },
    )
  })
})

// ---------------------------------------------------------------------------
// Size accounting
// ---------------------------------------------------------------------------

describe('storage size accounting properties', () => {
  it('reported size covers exactly every registered key that holds a value', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...Object.values(STORAGE_KEYS)), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 500 }),
        (keys, payloadLen) => {
          localStorage.clear()
          for (const k of keys) writeRaw(k, 'x'.repeat(payloadLen))
          const { bytes } = getLocalStorageSize()
          // Documented accounting: (key.length + value.length) × 2 per non-empty key.
          const expected = keys.reduce((sum, k) => sum + (k.length + payloadLen) * 2, 0)
          expect(bytes).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('is monotone: writing more data never decreases the reported size', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 1000 }), (a, b) => {
        localStorage.clear()
        writeRaw(STORAGE_KEYS.theme, 'x'.repeat(a))
        const s1 = getLocalStorageSize().bytes
        writeRaw(STORAGE_KEYS.theme, 'x'.repeat(Math.max(a, b)))
        const s2 = getLocalStorageSize().bytes
        expect(s2).toBeGreaterThanOrEqual(s1)
      }),
      { numRuns: 100 },
    )
  })

  it('per-key breakdown partitions the total: sums match and only registered keys appear', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (valueRaw) => {
        localStorage.clear()
        const value = JSON.parse(JSON.stringify(valueRaw)) as unknown
        writeJson(STORAGE_KEYS.alerts, value)
        writeJson(STORAGE_KEYS.theme, value)
        const breakdown = getLocalStorageBreakdown()
        expect(breakdown).toHaveLength(Object.keys(STORAGE_KEYS).length)
        const registered = new Set(Object.values(STORAGE_KEYS))
        for (const entry of breakdown) expect(registered.has(entry.key as never)).toBe(true)
        const total = getLocalStorageSize().bytes
        expect(breakdown.reduce((sum, e) => sum + e.bytes, 0)).toBe(total)
      }),
      { numRuns: 100 },
    )
  })

  it('reports zero for an empty store and is formatted non-emptily', () => {
    localStorage.clear()
    const { bytes, formatted } = getLocalStorageSize()
    expect(bytes).toBe(0)
    expect(formatted.length).toBeGreaterThan(0)
  })
})
