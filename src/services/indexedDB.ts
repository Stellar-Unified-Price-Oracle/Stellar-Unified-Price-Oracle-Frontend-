/**
 * IndexedDB service — SavedView type definitions and URL parameter helpers.
 *
 * The `SavedView` interface represents a named snapshot of the dashboard's
 * current search, filter, sort, and view-mode state. Views are persisted to
 * IndexedDB via the `useSavedViews` hook and can be shared as deep links via
 * `savedViewToUrlParams` / `urlParamsToSavedView`.
 */

/** A named, persisted snapshot of dashboard state. */
export interface SavedView {
  id: string
  name: string
  description?: string
  search: string
  filters: Record<string, unknown>
  sortField: string
  sortDirection: 'asc' | 'desc'
  viewMode: 'grid' | 'table'
  createdAt: number
  updatedAt: number
}

/**
 * Encodes the relevant parts of a `SavedView` as a URL search-params string.
 *
 * Included params:
 * - `search`        — free-text search query
 * - `sortField`     — field to sort by
 * - `sortDirection` — 'asc' | 'desc'
 * - `viewMode`      — 'grid' | 'table'
 * - `filters`       — JSON-encoded `Record<string, unknown>`
 *
 * @example
 * const qs = savedViewToUrlParams(view) // "search=BTC&sortField=price&..."
 * window.location.assign(`/?${qs}`)
 */
export function savedViewToUrlParams(view: SavedView): string {
  const params = new URLSearchParams()

  if (view.search) {
    params.set('search', view.search)
  }

  if (view.sortField) {
    params.set('sortField', view.sortField)
  }

  params.set('sortDirection', view.sortDirection)
  params.set('viewMode', view.viewMode)

  const filtersJson = JSON.stringify(view.filters)
  // Only include filters if they carry meaningful data (non-empty object)
  if (filtersJson !== '{}') {
    params.set('filters', filtersJson)
  }

  return params.toString()
}

/**
 * Decodes URL search params back into a partial `SavedView`.
 *
 * Only the fields that are present and valid in the params are returned.
 * Unknown or malformed `filters` JSON is silently ignored.
 *
 * @example
 * const partial = urlParamsToSavedView(new URLSearchParams(location.search))
 */
export function urlParamsToSavedView(params: URLSearchParams): Partial<SavedView> {
  const partial: Partial<SavedView> = {}

  const search = params.get('search')
  if (search !== null) {
    partial.search = search
  }

  const sortField = params.get('sortField')
  if (sortField) {
    partial.sortField = sortField
  }

  const sortDirection = params.get('sortDirection')
  if (sortDirection === 'asc' || sortDirection === 'desc') {
    partial.sortDirection = sortDirection
  }

  const viewMode = params.get('viewMode')
  if (viewMode === 'grid' || viewMode === 'table') {
    partial.viewMode = viewMode
  }

  const filtersRaw = params.get('filters')
  if (filtersRaw) {
    try {
      const parsed = JSON.parse(filtersRaw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        partial.filters = parsed as Record<string, unknown>
      }
    } catch {
      // Malformed JSON — skip filters rather than crashing
    }
  }

  return partial
}
