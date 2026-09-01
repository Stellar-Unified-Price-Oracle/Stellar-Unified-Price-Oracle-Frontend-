import { describe, it, expect } from 'vitest'
import {
  computeAlertStats,
  computeThresholdHint,
  formatTimeDuration,
  alertStatsToExportRow,
} from './alertAnalytics'
import type { AlertHistoryEntry } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(alertId: string, triggeredAt: number): AlertHistoryEntry {
  return {
    id: `entry-${triggeredAt}`,
    alertId,
    assetPair: 'XLM/USDC',
    triggeredAt,
    price: 0.12,
    triggerOnce: false,
    percentageMode: false,
    upperThreshold: 0.15,
    lowerThreshold: null,
    percentageThreshold: null,
    percentageWindow: null,
    percentageDirection: null,
  }
}

function makeAlert(overrides: Partial<{
  id: string
  upperThreshold: number | null
  lowerThreshold: number | null
  createdAt: number
  percentageMode: boolean
  percentageThreshold: number | null
}> = {}) {
  return {
    id: 'alert-1',
    upperThreshold: 0.15,
    lowerThreshold: null,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    percentageMode: false,
    percentageThreshold: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// formatTimeDuration
// ---------------------------------------------------------------------------

describe('formatTimeDuration', () => {
  it('formats 3 661 000 ms (1 h 1 m) correctly', () => {
    expect(formatTimeDuration(3_661_000)).toBe('1h 1m')
  })

  it('formats exactly 1 day as "1d 0h"', () => {
    expect(formatTimeDuration(86_400_000)).toBe('1d 0h')
  })

  it('formats 2 h 15 m', () => {
    expect(formatTimeDuration(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m')
  })

  it('formats 3 days 4 hours', () => {
    expect(formatTimeDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h')
  })

  it('formats 0 ms as 0h 0m', () => {
    expect(formatTimeDuration(0)).toBe('0h 0m')
  })
})

// ---------------------------------------------------------------------------
// computeAlertStats — core stats
// ---------------------------------------------------------------------------

describe('computeAlertStats', () => {
  it('returns fireCount=0 and null interval stats for empty history', () => {
    const alert = makeAlert()
    const stats = computeAlertStats(alert, [])

    expect(stats.fireCount).toBe(0)
    expect(stats.avgTimeToFire).toBeNull()
    expect(stats.maxTimeToFire).toBeNull()
    expect(stats.firstFiredAt).toBeNull()
    expect(stats.lastFiredAt).toBeNull()
  })

  it('ignores history entries belonging to other alerts', () => {
    const alert = makeAlert({ id: 'alert-1' })
    const history = [makeEntry('alert-other', Date.now())]

    const stats = computeAlertStats(alert, history)
    expect(stats.fireCount).toBe(0)
  })

  it('computes avgTimeToFire = 3 600 000 ms for 3 entries 1 h apart', () => {
    const base = 1_700_000_000_000 // fixed epoch
    const alert = makeAlert({ id: 'alert-1', createdAt: base - 3 * 3_600_000 })
    const history = [
      makeEntry('alert-1', base),
      makeEntry('alert-1', base + 3_600_000),
      makeEntry('alert-1', base + 2 * 3_600_000),
    ]

    const stats = computeAlertStats(alert, history)
    expect(stats.fireCount).toBe(3)
    expect(stats.avgTimeToFire).toBe(3_600_000)
  })

  it('computes maxTimeToFire from uneven intervals', () => {
    const base = 1_700_000_000_000
    const alert = makeAlert({ id: 'alert-1', createdAt: base - 10 * 3_600_000 })
    const history = [
      makeEntry('alert-1', base),
      makeEntry('alert-1', base + 1_000_000),  // 1000 s gap
      makeEntry('alert-1', base + 5_000_000),  // 4000 s gap  ← max
    ]

    const stats = computeAlertStats(alert, history)
    expect(stats.maxTimeToFire).toBe(4_000_000)
  })

  it('returns null for avgTimeToFire and maxTimeToFire when only 1 fire', () => {
    const alert = makeAlert({ id: 'alert-1' })
    const history = [makeEntry('alert-1', Date.now() - 3_600_000)]

    const stats = computeAlertStats(alert, history)
    expect(stats.avgTimeToFire).toBeNull()
    expect(stats.maxTimeToFire).toBeNull()
  })

  it('sets firstFiredAt and lastFiredAt correctly', () => {
    const base = 1_700_000_000_000
    const alert = makeAlert({ id: 'alert-1', createdAt: base - 10 * 3_600_000 })
    const history = [
      makeEntry('alert-1', base + 3_600_000),
      makeEntry('alert-1', base),               // out-of-order
      makeEntry('alert-1', base + 7_200_000),
    ]

    const stats = computeAlertStats(alert, history)
    expect(stats.firstFiredAt).toBe(base)
    expect(stats.lastFiredAt).toBe(base + 7_200_000)
  })

  it('computes hitRate as fires per day', () => {
    const now = Date.now()
    // Alert was created exactly 4 days ago, fired 8 times → 2/day
    const createdAt = now - 4 * 24 * 60 * 60 * 1000
    const alert = makeAlert({ id: 'alert-1', createdAt })
    const history = Array.from({ length: 8 }, (_, i) =>
      makeEntry('alert-1', createdAt + (i + 1) * 10_000_000),
    )

    const stats = computeAlertStats(alert, history)
    expect(stats.hitRate).toBeCloseTo(2, 1)
  })
})

// ---------------------------------------------------------------------------
// computeThresholdHint
// ---------------------------------------------------------------------------

describe('computeThresholdHint', () => {
  it('returns "too_close" when currentPrice is within 0.1% of upperThreshold and no fires', () => {
    const alert = makeAlert({ upperThreshold: 100, createdAt: Date.now() - 60_000 })
    const hint = computeThresholdHint(alert, [], 100.05) // 0.05% away

    expect(hint?.type).toBe('too_close')
  })

  it('does NOT return "too_close" when price is > 0.1% away', () => {
    const alert = makeAlert({ upperThreshold: 100, createdAt: Date.now() - 60_000 })
    const hint = computeThresholdHint(alert, [], 98) // 2% away

    expect(hint?.type).not.toBe('too_close')
  })

  it('returns "too_far" when fireCount=0 and alert is older than 7 days', () => {
    const createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 days ago
    const alert = makeAlert({ id: 'alert-stale', createdAt })

    const hint = computeThresholdHint(alert, [])
    expect(hint?.type).toBe('too_far')
  })

  it('does NOT return "too_far" for a 6-day-old alert that has never fired', () => {
    const createdAt = Date.now() - 6 * 24 * 60 * 60 * 1000 // 6 days ago
    const alert = makeAlert({ id: 'alert-young', createdAt })

    const hint = computeThresholdHint(alert, [])
    // Could be null or something else, just not too_far
    expect(hint?.type).not.toBe('too_far')
  })

  it('returns "high_false_positive" when > 20 fires within the first 24 hours', () => {
    const now = Date.now()
    const createdAt = now - 3 * 60 * 60 * 1000 // 3 hours ago (< 24 h)
    const alert = makeAlert({ id: 'alert-noisy', createdAt })
    const history = Array.from({ length: 21 }, (_, i) =>
      makeEntry('alert-noisy', createdAt + (i + 1) * 5 * 60 * 1000),
    )

    const hint = computeThresholdHint(alert, history)
    expect(hint?.type).toBe('high_false_positive')
  })

  it('returns "high_false_positive" when hitRate > 5', () => {
    const now = Date.now()
    // Created 1 day ago, 10 fires → hitRate = 10/day > 5
    const createdAt = now - 24 * 60 * 60 * 1000
    const alert = makeAlert({ id: 'alert-high', createdAt })
    const history = Array.from({ length: 10 }, (_, i) =>
      makeEntry('alert-high', createdAt + (i + 1) * 60 * 60 * 1000),
    )

    const hint = computeThresholdHint(alert, history)
    expect(hint?.type).toBe('high_false_positive')
  })

  it('returns "good_calibration" for 3 fires over 3 days (hitRate < 3)', () => {
    const now = Date.now()
    const createdAt = now - 3 * 24 * 60 * 60 * 1000
    const alert = makeAlert({ id: 'alert-good', createdAt })
    const history = [
      makeEntry('alert-good', createdAt + 24 * 60 * 60 * 1000),
      makeEntry('alert-good', createdAt + 48 * 60 * 60 * 1000),
      makeEntry('alert-good', createdAt + 72 * 60 * 60 * 1000),
    ]

    const hint = computeThresholdHint(alert, history)
    expect(hint?.type).toBe('good_calibration')
  })

  it('returns null when no special condition applies', () => {
    // Brand-new alert, no fires, no price data → should be null
    const alert = makeAlert({ createdAt: Date.now() - 60_000 })
    const hint = computeThresholdHint(alert, [])
    expect(hint).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// alertStatsToExportRow
// ---------------------------------------------------------------------------

describe('alertStatsToExportRow', () => {
  it('returns all expected keys', () => {
    const stats = computeAlertStats(makeAlert(), [])
    const row = alertStatsToExportRow(stats)

    expect(row).toHaveProperty('alertId')
    expect(row).toHaveProperty('fireCount')
    expect(row).toHaveProperty('avgTimeToFire')
    expect(row).toHaveProperty('maxTimeToFire')
    expect(row).toHaveProperty('hitRatePerDay')
    expect(row).toHaveProperty('thresholdHint')
  })

  it('serializes null intervals as empty string', () => {
    const stats = computeAlertStats(makeAlert(), [])
    const row = alertStatsToExportRow(stats)

    expect(row.avgTimeToFire).toBe('')
    expect(row.maxTimeToFire).toBe('')
  })

  it('serializes thresholdHint type string', () => {
    const now = Date.now()
    const createdAt = now - 8 * 24 * 60 * 60 * 1000 // 8 days, never fired
    const alert = makeAlert({ id: 'alert-stale', createdAt })
    const stats = computeAlertStats(alert, [])
    const row = alertStatsToExportRow(stats)

    expect(row.thresholdHint).toBe('too_far')
  })

  it('serializes no hint as empty string', () => {
    const alert = makeAlert({ createdAt: Date.now() - 1000 }) // brand new
    const stats = computeAlertStats(alert, [])
    const row = alertStatsToExportRow(stats)

    expect(row.thresholdHint).toBe('')
  })

  it('serializes numeric hitRate with 4 decimal places', () => {
    const now = Date.now()
    const createdAt = now - 2 * 24 * 60 * 60 * 1000 // 2 days
    const alert = makeAlert({ id: 'alert-rate', createdAt })
    const history = [makeEntry('alert-rate', createdAt + 3_600_000)]
    const stats = computeAlertStats(alert, history)
    const row = alertStatsToExportRow(stats)

    // 1 fire over 2 days = 0.5/day
    expect(typeof row.hitRatePerDay).toBe('number')
    expect(row.hitRatePerDay).toBeCloseTo(0.5, 1)
  })
})
