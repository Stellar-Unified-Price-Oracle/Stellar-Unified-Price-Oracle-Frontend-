import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export const KNOWN_SOURCES = ['chainlink', 'redstone', 'band', 'reflector'] as const

const SORT_OPTIONS = [
  { value: 'pair', label: 'Pair (A–Z)' },
  { value: 'price-high', label: 'Price (High → Low)' },
  { value: 'price-low', label: 'Price (Low → High)' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'recent', label: 'Last Updated' },
] as const

const UPDATED_WITHIN_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: '1h', label: '1 h' },
  { value: '6h', label: '6 h' },
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 d' },
] as const

export interface FilterState {
  sources: string[]
  minConf: number
  maxConf: number
  minPrice: string
  maxPrice: string
  updatedWithin: string
  sort: string
  sortDir: 'asc' | 'desc'
}

export function readFilterState(searchParams: URLSearchParams): FilterState {
  return {
    sources: searchParams.get('sources')?.split(',').filter(Boolean) ?? [],
    minConf: Number(searchParams.get('minConf') ?? '0'),
    maxConf: Number(searchParams.get('maxConf') ?? '100'),
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    updatedWithin: searchParams.get('updatedWithin') ?? 'all',
    sort: searchParams.get('sort') ?? '',
    sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') ?? 'desc',
  }
}

export function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.sources.length > 0 && f.sources.length < KNOWN_SOURCES.length) n++
  if (f.minConf > 0 || f.maxConf < 100) n++
  if (f.minPrice || f.maxPrice) n++
  if (f.updatedWithin !== 'all') n++
  if (f.sort) n++
  return n
}

interface Props {
  availableSources?: readonly string[]
}

export function FilterPanel({ availableSources = KNOWN_SOURCES }: Props) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const f = readFilterState(searchParams)

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) params.set(key, value)
      else params.delete(key)
      navigate({ search: params.toString() }, { replace: true })
    },
    [searchParams, navigate],
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    for (const key of ['sources', 'minConf', 'maxConf', 'minPrice', 'maxPrice', 'updatedWithin', 'sort', 'sortDir']) {
      params.delete(key)
    }
    navigate({ search: params.toString() }, { replace: true })
  }, [searchParams, navigate])

  const toggleSource = useCallback(
    (src: string) => {
      const effective = new Set(f.sources.length > 0 ? f.sources : [...availableSources])
      if (effective.has(src)) effective.delete(src)
      else effective.add(src)
      const next = [...effective]
      setParam('sources', next.length === availableSources.length ? '' : next.join(','))
    },
    [f.sources, availableSources, setParam],
  )

  const isSourceChecked = (src: string) =>
    f.sources.length === 0 || f.sources.includes(src)

  const activeCount = countActiveFilters(f)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-300">Filters &amp; Sort</span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sources */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Oracle Sources</p>
          <div className="flex flex-wrap gap-3">
            {availableSources.map((src) => (
              <label key={src} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSourceChecked(src)}
                  onChange={() => toggleSource(src)}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-300 capitalize">{src}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Last Updated */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Last Updated</p>
          <div className="flex flex-wrap gap-1.5">
            {UPDATED_WITHIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setParam('updatedWithin', opt.value === 'all' ? '' : opt.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  f.updatedWithin === opt.value || (opt.value === 'all' && f.updatedWithin === 'all')
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence Range */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Confidence: {f.minConf}%–{f.maxConf}%
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-5">Min</span>
              <input
                type="range"
                min="0"
                max="100"
                value={f.minConf}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val <= f.maxConf) setParam('minConf', val === 0 ? '' : String(val))
                }}
                className="flex-1 accent-cyan-500"
                aria-label="Minimum confidence"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{f.minConf}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-5">Max</span>
              <input
                type="range"
                min="0"
                max="100"
                value={f.maxConf}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val >= f.minConf) setParam('maxConf', val === 100 ? '' : String(val))
                }}
                className="flex-1 accent-cyan-500"
                aria-label="Maximum confidence"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{f.maxConf}%</span>
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Price Range</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Min"
              value={f.minPrice}
              onChange={(e) => setParam('minPrice', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Minimum price"
            />
            <span className="text-gray-600 text-sm shrink-0">–</span>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Max"
              value={f.maxPrice}
              onChange={(e) => setParam('maxPrice', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Maximum price"
            />
          </div>
        </div>
      </div>

      {/* Sort */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sort By</p>
        <div className="flex items-center gap-2">
          <select
            value={f.sort}
            onChange={(e) => setParam('sort', e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            aria-label="Sort by"
          >
            <option value="">Default</option>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setParam('sortDir', f.sortDir === 'asc' ? 'desc' : 'asc')}
            title={f.sortDir === 'asc' ? 'Ascending' : 'Descending'}
            aria-label={`Sort direction: ${f.sortDir === 'asc' ? 'ascending' : 'descending'}`}
            className="p-1.5 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            {f.sortDir === 'asc' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h5m10 8l-4-4m0 0l-4 4m4-4V4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h5m10 0l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
