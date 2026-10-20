import { describe, expect, it } from 'vitest'
import { resolveOfflineDataState } from './offlineDataState'

describe('resolveOfflineDataState', () => {
  it('prefers live prices over any snapshot', () => {
    expect(resolveOfflineDataState({ hasLivePrices: true, hasSnapshot: true })).toBe('live')
    expect(resolveOfflineDataState({ hasLivePrices: true, hasSnapshot: false })).toBe('live')
  })

  it('reports stale when only a snapshot is available', () => {
    expect(resolveOfflineDataState({ hasLivePrices: false, hasSnapshot: true })).toBe('stale')
  })

  it('reports unavailable when neither live prices nor a snapshot exist', () => {
    expect(resolveOfflineDataState({ hasLivePrices: false, hasSnapshot: false })).toBe('unavailable')
  })
})
