import { describe, expect, it } from 'vitest'
import { DASHBOARD_DENSITIES, DEFAULT_DASHBOARD_DENSITY, densityGridGapClass, toDashboardDensity } from './density'

describe('toDashboardDensity', () => {
  it.each(DASHBOARD_DENSITIES)('keeps the known density %s', (density) => {
    expect(toDashboardDensity(density)).toBe(density)
  })

  it.each([undefined, null, '', 'huge', 42, { density: 'compact' }])(
    'falls back to the default for untrusted value %j',
    (value) => {
      expect(toDashboardDensity(value)).toBe(DEFAULT_DASHBOARD_DENSITY)
    },
  )
})

describe('densityGridGapClass', () => {
  it('maps each density to a distinct gap, widening from compact to spacious', () => {
    expect(densityGridGapClass('compact')).toBe('gap-2')
    expect(densityGridGapClass('comfortable')).toBe('gap-4')
    expect(densityGridGapClass('spacious')).toBe('gap-6')
  })

  it('uses the comfortable gap when given an invalid density', () => {
    expect(densityGridGapClass('nonsense' as never)).toBe('gap-4')
  })
})
