import { describe, it, expect, beforeEach } from 'vitest'
import type { ParameterRecord } from '../types'
import {
  getStoredWatchedKeys,
  setStoredWatchedKeys,
  getStoredSnapshots,
  setStoredSnapshots,
  detectWatchedChanges,
  WATCHED_PARAMS_STORAGE_KEY,
  WATCHED_SNAPSHOTS_STORAGE_KEY,
} from './parameterNotifications'

const NOW = 1_700_000_000_000

function makeRecord(overrides: Partial<ParameterRecord> = {}): ParameterRecord {
  return {
    key: 'aggregator.minSources',
    label: 'Minimum sources',
    category: 'aggregation',
    currentValue: '3',
    owner: 'GA1234567890ABCDEF',
    lastChangedAt: NOW - 5000,
    history: [],
    ...overrides,
  }
}

describe('parameterNotifications', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('storage operations', () => {
    it('returns empty array when no watched keys are stored', () => {
      expect(getStoredWatchedKeys()).toEqual([])
    })

    it('stores and retrieves watched keys deduplicated', () => {
      setStoredWatchedKeys(['param.a', 'param.b', 'param.a'])
      expect(getStoredWatchedKeys()).toEqual(['param.a', 'param.b'])
      expect(localStorage.getItem(WATCHED_PARAMS_STORAGE_KEY)).toContain('param.a')
    })

    it('handles corrupted JSON in watched keys gracefully', () => {
      localStorage.setItem(WATCHED_PARAMS_STORAGE_KEY, '{invalid')
      expect(getStoredWatchedKeys()).toEqual([])
    })

    it('stores and retrieves snapshots', () => {
      const snapshots = {
        'param.a': {
          lastChangedAt: NOW,
          currentValue: '10',
          label: 'Param A',
        },
      }
      setStoredSnapshots(snapshots)
      expect(getStoredSnapshots()).toEqual(snapshots)
      expect(localStorage.getItem(WATCHED_SNAPSHOTS_STORAGE_KEY)).toContain('Param A')
    })

    it('handles corrupted JSON in snapshots gracefully', () => {
      localStorage.setItem(WATCHED_SNAPSHOTS_STORAGE_KEY, 'not-json')
      expect(getStoredSnapshots()).toEqual({})
    })
  })

  describe('detectWatchedChanges', () => {
    it('initializes snapshot without triggering change for newly watched parameter', () => {
      const record = makeRecord({ key: 'agg.sources', currentValue: '3', lastChangedAt: NOW - 1000 })
      const watchedKeys = new Set(['agg.sources'])
      const { changes, updatedSnapshots } = detectWatchedChanges([record], watchedKeys, {})

      expect(changes).toHaveLength(0)
      expect(updatedSnapshots['agg.sources']).toEqual({
        lastChangedAt: NOW - 1000,
        currentValue: '3',
        label: record.label,
      })
    })

    it('detects a value change on a watched parameter', () => {
      const record = makeRecord({ key: 'agg.sources', currentValue: '5', lastChangedAt: NOW })
      const watchedKeys = new Set(['agg.sources'])
      const previousSnapshots = {
        'agg.sources': {
          lastChangedAt: NOW - 10_000,
          currentValue: '3',
          label: 'Minimum sources',
        },
      }

      const { changes, updatedSnapshots } = detectWatchedChanges([record], watchedKeys, previousSnapshots, NOW)

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({
        key: 'agg.sources',
        label: 'Minimum sources',
        previousValue: '3',
        newValue: '5',
        changedAt: NOW,
        detectedAt: NOW,
      })
      expect(updatedSnapshots['agg.sources'].currentValue).toBe('5')
    })

    it('detects a timestamp change even if formatted value looks identical', () => {
      const record = makeRecord({ key: 'threshold.deviation', currentValue: '0.05', lastChangedAt: NOW + 1000 })
      const watchedKeys = new Set(['threshold.deviation'])
      const previousSnapshots = {
        'threshold.deviation': {
          lastChangedAt: NOW,
          currentValue: '0.05',
          label: 'Max deviation',
        },
      }

      const { changes } = detectWatchedChanges([record], watchedKeys, previousSnapshots, NOW + 2000)
      expect(changes).toHaveLength(1)
      expect(changes[0].changedAt).toBe(NOW + 1000)
    })

    it('ignores changes to unwatched parameters', () => {
      const record1 = makeRecord({ key: 'watched.param', currentValue: '10' })
      const record2 = makeRecord({ key: 'unwatched.param', currentValue: '99' })
      const watchedKeys = new Set(['watched.param'])
      const previousSnapshots = {
        'watched.param': {
          lastChangedAt: NOW - 1000,
          currentValue: '10',
          label: 'Watched',
        },
        'unwatched.param': {
          lastChangedAt: NOW - 1000,
          currentValue: '50',
          label: 'Unwatched',
        },
      }

      const { changes } = detectWatchedChanges([record1, record2], watchedKeys, previousSnapshots)
      expect(changes).toHaveLength(0)
    })
  })
})
