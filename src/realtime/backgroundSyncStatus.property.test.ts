import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { PriceResyncProgress } from '../types/realtime'
import { resolveBackgroundSyncState } from './backgroundSyncStatus'

const statuses = fc.constantFrom<PriceResyncProgress['status']>('syncing', 'complete', 'partial', 'failed')
const progress = fc.record({
  status: statuses,
  total: fc.nat(10),
  completed: fc.nat(10),
  failed: fc.nat(10),
  startedAt: fc.nat(),
})
const input = fc.record({
  progress: fc.option(progress, { nil: null }),
  isOnline: fc.boolean(),
  queued: fc.nat(5),
  blocked: fc.boolean(),
})

describe('resolveBackgroundSyncState (properties)', () => {
  it('never reports idle when a run exists or sync cannot proceed', () => {
    fc.assert(
      fc.property(input, (value) => {
        const state = resolveBackgroundSyncState(value)
        const canProceed = value.isOnline && !value.blocked && value.queued === 0
        if (value.progress || !canProceed) expect(state).not.toBe('idle')
      }),
    )
  })

  it('mirrors the last run status whenever one exists', () => {
    fc.assert(
      fc.property(input, (value) => {
        if (!value.progress) return
        expect(resolveBackgroundSyncState(value)).toBe(value.progress.status)
      }),
    )
  })
})
