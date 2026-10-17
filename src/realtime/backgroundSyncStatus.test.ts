import { describe, expect, it } from 'vitest'
import type { PriceResyncProgress } from '../types/realtime'
import { resolveBackgroundSyncState } from './backgroundSyncStatus'

const run = (status: PriceResyncProgress['status']): PriceResyncProgress => ({
  status,
  total: 3,
  completed: 3,
  failed: status === 'failed' ? 3 : 0,
  startedAt: 0,
})

const online = { isOnline: true, queued: 0, blocked: false }

describe('resolveBackgroundSyncState', () => {
  it('is idle when online with nothing queued and no run yet', () => {
    expect(resolveBackgroundSyncState({ progress: null, ...online })).toBe('idle')
  })

  it('is pending while offline before any run has completed', () => {
    expect(resolveBackgroundSyncState({ progress: null, ...online, isOnline: false })).toBe('pending')
  })

  it('is pending while the server has paused requests or requests are queued', () => {
    expect(resolveBackgroundSyncState({ progress: null, ...online, blocked: true })).toBe('pending')
    expect(resolveBackgroundSyncState({ progress: null, ...online, queued: 2 })).toBe('pending')
  })

  it('surfaces a failed or partial run even when offline', () => {
    expect(resolveBackgroundSyncState({ progress: run('failed'), ...online, isOnline: false })).toBe('failed')
    expect(resolveBackgroundSyncState({ progress: run('partial'), ...online, isOnline: false })).toBe('partial')
  })

  it('keeps a completed run as complete after the network drops', () => {
    expect(resolveBackgroundSyncState({ progress: run('complete'), ...online, isOnline: false })).toBe('complete')
  })
})
