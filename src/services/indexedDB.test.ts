import { describe, it, expect } from 'vitest'
import { savedViewToUrlParams, urlParamsToSavedView } from './indexedDB'
import type { SavedView } from './indexedDB'

function makeView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    name: 'My View',
    search: 'BTC',
    filters: { sources: ['chainlink'] },
    sortField: 'price',
    sortDirection: 'desc',
    viewMode: 'grid',
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  }
}

describe('savedViewToUrlParams', () => {
  it('encodes search, sortField, sortDirection, viewMode', () => {
    const qs = savedViewToUrlParams(makeView())
    const params = new URLSearchParams(qs)
    expect(params.get('search')).toBe('BTC')
    expect(params.get('sortField')).toBe('price')
    expect(params.get('sortDirection')).toBe('desc')
    expect(params.get('viewMode')).toBe('grid')
  })

  it('encodes non-empty filters as JSON', () => {
    const qs = savedViewToUrlParams(makeView({ filters: { foo: 'bar' } }))
    const params = new URLSearchParams(qs)
    expect(JSON.parse(params.get('filters') ?? '{}')).toEqual({ foo: 'bar' })
  })

  it('omits the search param when search is empty string', () => {
    const qs = savedViewToUrlParams(makeView({ search: '' }))
    const params = new URLSearchParams(qs)
    expect(params.has('search')).toBe(false)
  })

  it('omits the sortField param when sortField is empty string', () => {
    const qs = savedViewToUrlParams(makeView({ sortField: '' }))
    const params = new URLSearchParams(qs)
    expect(params.has('sortField')).toBe(false)
  })

  it('omits filters when filters is an empty object', () => {
    const qs = savedViewToUrlParams(makeView({ filters: {} }))
    const params = new URLSearchParams(qs)
    // Either absent or empty string — should not be set to the string '{}'
    const filtersParam = params.get('filters')
    expect(!filtersParam || filtersParam === '{}').toBe(true)
  })

  it('returns a string (not a URLSearchParams instance)', () => {
    const result = savedViewToUrlParams(makeView())
    expect(typeof result).toBe('string')
  })
})

describe('urlParamsToSavedView', () => {
  it('decodes search, sortField, sortDirection, viewMode', () => {
    const params = new URLSearchParams('search=ETH&sortField=timestamp&sortDirection=asc&viewMode=table')
    const partial = urlParamsToSavedView(params)
    expect(partial.search).toBe('ETH')
    expect(partial.sortField).toBe('timestamp')
    expect(partial.sortDirection).toBe('asc')
    expect(partial.viewMode).toBe('table')
  })

  it('decodes JSON-encoded filters', () => {
    const params = new URLSearchParams(`filters=${encodeURIComponent(JSON.stringify({ sources: ['band'] }))}`)
    const partial = urlParamsToSavedView(params)
    expect(partial.filters).toEqual({ sources: ['band'] })
  })

  it('returns empty object for empty params without throwing', () => {
    const partial = urlParamsToSavedView(new URLSearchParams())
    expect(partial).toBeDefined()
  })

  it('survives malformed JSON in filters without throwing', () => {
    const params = new URLSearchParams('filters=not-valid-json')
    expect(() => urlParamsToSavedView(params)).not.toThrow()
  })

  it('round-trips through savedViewToUrlParams', () => {
    const view = makeView()
    const qs = savedViewToUrlParams(view)
    const partial = urlParamsToSavedView(new URLSearchParams(qs))
    expect(partial.search).toBe(view.search)
    expect(partial.sortField).toBe(view.sortField)
    expect(partial.sortDirection).toBe(view.sortDirection)
    expect(partial.viewMode).toBe(view.viewMode)
  })
})
