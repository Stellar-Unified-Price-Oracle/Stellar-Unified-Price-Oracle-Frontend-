/**
 * Opt-in, device-local memory for dashboard filters (#812).
 *
 * The filter state lives in the URL, so it is lost when the user opens a fresh link.
 * Ticking "Remember these filters on this device only" in the filter panel copies the
 * filter params into localStorage, and the dashboard re-applies them on the next visit
 * when the URL carries no filters.
 *
 * Scope is deliberately narrow:
 * - Only the filter params in {@link FILTER_PARAM_KEYS} are stored. Search text,
 *   workspace share params, and other URL state are never persisted.
 * - Nothing is written until the user opts in, and unticking the box deletes the entry.
 * - The entry lives in `localStorage` through `utils/storage.ts` and never leaves the
 *   browser.
 */

import { STORAGE_KEYS, readJson, remove, writeJson } from './storage'

/** URL params that make up the dashboard filter state. */
export const FILTER_PARAM_KEYS = [
  'sources',
  'minConf',
  'maxConf',
  'minPrice',
  'maxPrice',
  'updatedWithin',
  'sort',
  'sortDir',
] as const

/** Stored values are untrusted input, so the query is capped before it is parsed. */
const MAX_REMEMBERED_QUERY_LENGTH = 1000

interface RememberedFilters {
  query: string
}

function isRememberedFilters(value: unknown): value is RememberedFilters {
  if (typeof value !== 'object' || value === null) return false
  const query = (value as { query?: unknown }).query
  return typeof query === 'string' && query.length <= MAX_REMEMBERED_QUERY_LENGTH
}

/** Returns a new URLSearchParams holding only the filter params that have a value. */
export function pickFilterParams(searchParams: URLSearchParams): URLSearchParams {
  const picked = new URLSearchParams()
  for (const key of FILTER_PARAM_KEYS) {
    const value = searchParams.get(key)
    if (value) picked.set(key, value)
  }
  return picked
}

/** True when the URL already carries at least one filter param. */
export function hasFilterParams(searchParams: URLSearchParams): boolean {
  return FILTER_PARAM_KEYS.some((key) => searchParams.has(key))
}

/** True when the user has opted in and a remembered entry exists on this device. */
export function isRememberingFilters(): boolean {
  return readJson<RememberedFilters | null>(STORAGE_KEYS.dashboardFilters, null, isRememberedFilters) !== null
}

/**
 * Returns the remembered filter params, or `null` when the user has not opted in.
 * Malformed entries are treated as absent.
 */
export function readRememberedFilters(): URLSearchParams | null {
  const stored = readJson<RememberedFilters | null>(STORAGE_KEYS.dashboardFilters, null, isRememberedFilters)
  if (stored === null) return null
  return pickFilterParams(new URLSearchParams(stored.query))
}

/** Saves the filter params from `searchParams`. Returns `false` when the write did not land. */
export function rememberFilters(searchParams: URLSearchParams): boolean {
  return writeJson(STORAGE_KEYS.dashboardFilters, { query: pickFilterParams(searchParams).toString() })
}

/** Deletes the remembered entry. Called when the user unticks the opt-in box. */
export function forgetFilters(): void {
  remove(STORAGE_KEYS.dashboardFilters)
}
