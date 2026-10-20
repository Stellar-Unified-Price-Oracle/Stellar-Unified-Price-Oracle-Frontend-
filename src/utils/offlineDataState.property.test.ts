import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { resolveOfflineDataState } from './offlineDataState'

describe('resolveOfflineDataState (properties)', () => {
  it('is unavailable exactly when there is no live data and no snapshot', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (hasLivePrices, hasSnapshot) => {
        const state = resolveOfflineDataState({ hasLivePrices, hasSnapshot })
        expect(state === 'unavailable').toBe(!hasLivePrices && !hasSnapshot)
      }),
    )
  })

  it('never reports stale or unavailable while live prices are present', () => {
    fc.assert(
      fc.property(fc.boolean(), (hasSnapshot) => {
        expect(resolveOfflineDataState({ hasLivePrices: true, hasSnapshot })).toBe('live')
      }),
    )
  })
})
