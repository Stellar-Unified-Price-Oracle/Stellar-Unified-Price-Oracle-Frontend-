import { describe, it, expect } from 'vitest'
import {
  computeParameterDelta,
  formatDiffValue,
  getDiffBadgeMeta,
  hasParameterChanges,
  groupParameterChangesByCategory,
} from './governanceParameterDiff'
import type { ProposedParameterChange } from '../types/governance'

describe('governanceParameterDiff utils', () => {
  describe('computeParameterDelta', () => {
    it('computes integer increase correctly', () => {
      const result = computeParameterDelta('3', '5')
      expect(result).not.toBeNull()
      expect(result?.delta).toBe(2)
      expect(result?.formattedDelta).toBe('+2')
      expect(result?.percentChange).toBeCloseTo(66.67, 1)
      expect(result?.formattedPercent).toBe('+66.7%')
      expect(result?.direction).toBe('increase')
    })

    it('computes decimal decrease correctly', () => {
      const result = computeParameterDelta('0.50', '0.35')
      expect(result).not.toBeNull()
      expect(result?.delta).toBeCloseTo(-0.15, 3)
      expect(result?.formattedDelta).toBe('-0.15')
      expect(result?.percentChange).toBeCloseTo(-30, 1)
      expect(result?.formattedPercent).toBe('-30.0%')
      expect(result?.direction).toBe('decrease')
    })

    it('handles percentage input cleanly', () => {
      const result = computeParameterDelta('5%', '10%')
      expect(result).not.toBeNull()
      expect(result?.delta).toBe(5)
      expect(result?.formattedDelta).toBe('+5')
      expect(result?.percentChange).toBe(100)
      expect(result?.formattedPercent).toBe('+100.0%')
    })

    it('returns null for non-numeric or null values', () => {
      expect(computeParameterDelta(null, '5')).toBeNull()
      expect(computeParameterDelta('5', null)).toBeNull()
      expect(computeParameterDelta('strict', 'relaxed')).toBeNull()
      expect(computeParameterDelta('GABC123', 'GDEF456')).toBeNull()
    })

    it('handles unchanged values', () => {
      const result = computeParameterDelta('10', '10')
      expect(result).not.toBeNull()
      expect(result?.delta).toBe(0)
      expect(result?.formattedDelta).toBe('0')
      expect(result?.direction).toBe('unchanged')
    })
  })

  describe('formatDiffValue', () => {
    it('returns explicit placeholder for null or undefined without guessing', () => {
      expect(formatDiffValue(null)).toBe('Not set / Unreported')
      expect(formatDiffValue(undefined)).toBe('Not set / Unreported')
    })

    it('formats string with unit suffix if provided', () => {
      expect(formatDiffValue('60', 'seconds')).toBe('60 seconds')
      expect(formatDiffValue('60 seconds', 'seconds')).toBe('60 seconds')
    })

    it('handles empty string explicitly', () => {
      expect(formatDiffValue('')).toBe('(empty)')
      expect(formatDiffValue('   ')).toBe('(empty)')
    })
  })

  describe('getDiffBadgeMeta', () => {
    it('returns appropriate badge styling for each diff type', () => {
      const add = getDiffBadgeMeta('add')
      expect(add.label).toBe('New Parameter')
      expect(add.icon).toBe('+')

      const remove = getDiffBadgeMeta('remove')
      expect(remove.label).toBe('Deprecating')
      expect(remove.icon).toBe('−')

      const modify = getDiffBadgeMeta('modify')
      expect(modify.label).toBe('Modified')
      expect(modify.icon).toBe('Δ')
    })
  })

  describe('hasParameterChanges', () => {
    it('returns true when changes exist and false otherwise', () => {
      expect(hasParameterChanges(null)).toBe(false)
      expect(hasParameterChanges(undefined)).toBe(false)
      expect(hasParameterChanges({})).toBe(false)
      expect(hasParameterChanges({ proposedParameterChanges: [] })).toBe(false)

      const change: ProposedParameterChange = {
        paramKey: 'aggregator.minSources',
        paramName: 'Min Sources',
        category: 'aggregation',
        currentValue: '3',
        proposedValue: '4',
        diffType: 'modify',
      }
      expect(hasParameterChanges({ proposedParameterChanges: [change] })).toBe(true)
    })
  })

  describe('groupParameterChangesByCategory', () => {
    it('groups changes by their category', () => {
      const changes: ProposedParameterChange[] = [
        {
          paramKey: 'aggregator.minSources',
          paramName: 'Min Sources',
          category: 'aggregation',
          currentValue: '3',
          proposedValue: '4',
          diffType: 'modify',
        },
        {
          paramKey: 'aggregator.heartbeatSec',
          paramName: 'Heartbeat',
          category: 'aggregation',
          currentValue: '60',
          proposedValue: '30',
          diffType: 'modify',
        },
        {
          paramKey: 'threshold.deviation',
          paramName: 'Deviation Threshold',
          category: 'thresholds',
          currentValue: '0.05',
          proposedValue: '0.03',
          diffType: 'modify',
        },
      ]

      const grouped = groupParameterChangesByCategory(changes)
      expect(Object.keys(grouped)).toEqual(['aggregation', 'thresholds'])
      expect(grouped['aggregation'].length).toBe(2)
      expect(grouped['thresholds'].length).toBe(1)
    })
  })
})
