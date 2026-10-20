import { describe, it, expect } from 'vitest'
import { sanitizeHiddenTableColumns } from './tableColumns'

describe('sanitizeHiddenTableColumns', () => {
  it('returns an empty list for non-array values', () => {
    expect(sanitizeHiddenTableColumns(undefined)).toEqual([])
    expect(sanitizeHiddenTableColumns('confidence')).toEqual([])
    expect(sanitizeHiddenTableColumns({ confidence: true })).toEqual([])
  })

  it('drops unknown keys, including pair and price which cannot be hidden', () => {
    expect(sanitizeHiddenTableColumns(['assetPair', 'price', 'bogus', 'sources'])).toEqual(['sources'])
  })

  it('removes duplicates and returns columns in display order', () => {
    expect(sanitizeHiddenTableColumns(['timestamp', 'confidence', 'timestamp'])).toEqual(['confidence', 'timestamp'])
  })
})
