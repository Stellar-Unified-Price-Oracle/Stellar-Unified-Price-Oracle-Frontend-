import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

export function FilterBar() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') || ''
  const confidence = searchParams.get('confidence') || 'all'
  const source = searchParams.get('source') || 'all'

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (e.target.value) {
          next.set('search', e.target.value)
        } else {
          next.delete('search')
        }
        return next
      })
    },
    [setSearchParams]
  )

  const handleConfidenceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (e.target.value !== 'all') {
          next.set('confidence', e.target.value)
        } else {
          next.delete('confidence')
        }
        return next
      })
    },
    [setSearchParams]
  )

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (e.target.value !== 'all') {
          next.set('source', e.target.value)
        } else {
          next.delete('source')
        }
        return next
      })
    },
    [setSearchParams]
  )

  const handleClearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 shadow-lg shadow-black/20 flex flex-col md:flex-row gap-4 items-end md:items-center">
      <div className="flex-1 w-full relative">
        <label htmlFor="search" className="block text-sm font-medium text-gray-400 mb-1.5">
          Search Asset Pair
        </label>
        <div className="relative">
          <input
            id="search"
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="e.g. XLM"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors pl-10"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <div className="w-full md:w-48">
        <label htmlFor="confidence" className="block text-sm font-medium text-gray-400 mb-1.5">
          Confidence
        </label>
        <select
          id="confidence"
          value={confidence}
          onChange={handleConfidenceChange}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none"
        >
          <option value="all">All Confidence</option>
          <option value="high">High (&gt;80%)</option>
          <option value="medium">Medium (&gt;50%)</option>
        </select>
      </div>

      <div className="w-full md:w-48">
        <label htmlFor="source" className="block text-sm font-medium text-gray-400 mb-1.5">
          Oracle Source
        </label>
        <select
          id="source"
          value={source}
          onChange={handleSourceChange}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none capitalize"
        >
          <option value="all">All Sources</option>
          <option value="chainlink">Chainlink</option>
          <option value="redstone">Redstone</option>
          <option value="band">Band</option>
          <option value="reflector">Reflector</option>
        </select>
      </div>

      <div className="w-full md:w-auto">
        <button
          onClick={handleClearFilters}
          className="w-full mt-6 md:w-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
          aria-label="Clear all filters"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
