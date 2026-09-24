import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { idbCache } from '../hooks/useIndexedDB'
import { saveAlertHistory } from '../services/alertHistory'
import type { AlertHistoryEntry } from '../types'
import { readRaw, STORAGE_KEYS } from './storage'
import {
  persistDurable,
  flushPendingWrites,
  flushPendingWritesSync,
  getPendingWrites,
  installDurableWriteListeners,
  _resetDurableWrites,
} from './durableWrites'

/** Makes every `localStorage.setItem` throw, as a full quota or private mode would. */
function failStorageWrites() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota exceeded', 'QuotaExceededError')
  })
}

/** Waits for the fire-and-forget outbox write to reach IndexedDB. */
function waitForOutbox() {
  return vi.waitFor(async () => {
    expect(await idbCache.get('preferences', 'durable-writes', Infinity)).toBeTruthy()
  })
}

beforeEach(async () => {
  localStorage.clear()
  idbCache._reset()
  _resetDurableWrites()
  await idbCache.clear('preferences')
})

afterEach(() => {
  vi.restoreAllMocks()
  _resetDurableWrites()
})

describe('persistDurable', () => {
  it('persists and leaves nothing pending when the write lands', () => {
    expect(persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])).toBe(true)
    expect(readRaw(STORAGE_KEYS.alerts)).toBe(JSON.stringify([{ id: 'a1' }]))
    expect(getPendingWrites()).toEqual([])
  })

  it('queues the value for retry when storage rejects the write', () => {
    failStorageWrites()

    expect(persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])).toBe(false)
    expect(readRaw(STORAGE_KEYS.alerts)).toBeNull()

    expect(getPendingWrites()).toHaveLength(1)
    expect(getPendingWrites()[0]).toMatchObject({
      key: STORAGE_KEYS.alerts,
      serialized: JSON.stringify([{ id: 'a1' }]),
      attempts: 1,
    })
  })

  it('reports but does not queue a value that cannot be serialized', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(persistDurable(STORAGE_KEYS.alerts, circular)).toBe(false)
    // A retry would fail identically, so there is nothing useful to queue.
    expect(getPendingWrites()).toEqual([])
  })
})

describe('flushPendingWrites', () => {
  it('replays a queued write once storage recovers', async () => {
    const quota = failStorageWrites()
    expect(persistDurable(STORAGE_KEYS.alertHistory, [{ id: 'e1' }])).toBe(false)
    quota.mockRestore()

    expect(await flushPendingWrites()).toBe(1)
    expect(readRaw(STORAGE_KEYS.alertHistory)).toBe(JSON.stringify([{ id: 'e1' }]))
    expect(getPendingWrites()).toEqual([])
  })

  it('recovers a queued write across a reload, from the IndexedDB outbox', async () => {
    const quota = failStorageWrites()
    persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])
    await waitForOutbox()

    // Simulate a reload: storage works again, the browser restarted, so only the
    // persisted outbox survives.
    quota.mockRestore()
    _resetDurableWrites()

    expect(await flushPendingWrites()).toBe(1)
    expect(readRaw(STORAGE_KEYS.alerts)).toBe(JSON.stringify([{ id: 'a1' }]))
  })

  it('does not let a stale queued write clobber a later successful one', async () => {
    const quota = failStorageWrites()
    persistDurable(STORAGE_KEYS.alerts, [{ id: 'old' }])
    await waitForOutbox()

    quota.mockRestore()
    expect(persistDurable(STORAGE_KEYS.alerts, [{ id: 'new' }])).toBe(true)

    await flushPendingWrites()
    expect(readRaw(STORAGE_KEYS.alerts)).toBe(JSON.stringify([{ id: 'new' }]))
    expect(getPendingWrites()).toEqual([])
  })

  it('keeps a still-failing write queued and counts its attempts', async () => {
    const quota = failStorageWrites()
    persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])

    expect(await flushPendingWrites()).toBe(0)
    expect(getPendingWrites()[0].attempts).toBe(2)
    expect(quota).toHaveBeenCalled()
  })

  it('ignores a corrupt outbox rather than throwing', async () => {
    await idbCache.set('preferences', 'durable-writes', { bad: 'shape' })

    expect(await flushPendingWrites()).toBe(0)
    expect(getPendingWrites()).toEqual([])
  })
})

describe('flushPendingWritesSync', () => {
  it('flushes in-memory pending writes synchronously for pagehide', () => {
    const quota = failStorageWrites()
    persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])
    quota.mockRestore()

    expect(flushPendingWritesSync()).toBe(1)
    expect(readRaw(STORAGE_KEYS.alerts)).toBe(JSON.stringify([{ id: 'a1' }]))
  })
})

describe('consumer wiring', () => {
  it('queues a failed alert-history write instead of dropping it', async () => {
    const quota = failStorageWrites()
    saveAlertHistory([{ id: 'e1' } as AlertHistoryEntry])
    quota.mockRestore()

    expect(await flushPendingWrites()).toBe(1)
    expect(readRaw(STORAGE_KEYS.alertHistory)).toBe(JSON.stringify([{ id: 'e1' }]))
  })
})

describe('startup recovery', () => {
  it('recovers a write left behind by a previous session, as main.tsx arms it', async () => {
    const quota = failStorageWrites()
    persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])
    await waitForOutbox()

    // Simulate a reload: storage works again and nothing is left in memory.
    quota.mockRestore()
    _resetDurableWrites()

    installDurableWriteListeners()
    await vi.waitFor(() => {
      expect(readRaw(STORAGE_KEYS.alerts)).toBe(JSON.stringify([{ id: 'a1' }]))
    })
  })
})

describe('outbox I/O failures', () => {
  it('still retries from memory when the outbox cannot be written', async () => {
    const quota = failStorageWrites()
    persistDurable(STORAGE_KEYS.alerts, [{ id: 'a1' }])
    quota.mockRestore()

    // The outbox write failed, so the entry survived only in memory. That is
    // still enough for the retry to land the value.
    const outboxWrite = vi.spyOn(idbCache, 'set').mockRejectedValue(new Error('IndexedDB unavailable'))
    expect(await flushPendingWrites()).toBe(1)

    expect(readRaw(STORAGE_KEYS.alerts)).toBe(JSON.stringify([{ id: 'a1' }]))
    outboxWrite.mockRestore()
  })

  it('does not reject when the outbox cannot be read', async () => {
    const outboxRead = vi.spyOn(idbCache, 'get').mockRejectedValue(new Error('IndexedDB unavailable'))

    await expect(flushPendingWrites()).resolves.toBe(0)
    expect(() => installDurableWriteListeners()).not.toThrow()

    outboxRead.mockRestore()
  })
})
