import { useSearchParams } from 'react-router-dom'
import { useCallback, useRef, useState, useId } from 'react'
import { getAutocompleteSuggestions, parseSearch } from '../utils/searchParser'

/** Returns active operator tokens (source:x, confidence:x, etc.) from the raw search string */
function extractOperatorTokens(raw: string): string[] {
  return (raw.match(/\S+:\S+/g) ?? [])
}

function extractPlainText(raw: string): string {
  return raw
    .replace(/\S+:\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeToken(raw: string, token: string): string {
  return raw
    .replace(token, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function FilterBar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const listboxId = useId()

  const rawSearch = searchParams.get('search') || ''
  const confidence = searchParams.get('confidence') || 'all'
  const source = searchParams.get('source') || 'all'
  const sort = searchParams.get('sort') || ''

  const [inputValue, setInputValue] = useState(rawSearch)
  const [suggestions, setSuggestions] = useState<ReturnType<typeof getAutocompleteSuggestions>>([])
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Active operator pills derived from the stored search string
  const operatorTokens = extractOperatorTokens(rawSearch)

  const commitSearch = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value.trim()) {
          next.set('search', value.trim())
        } else {
          next.delete('search')
        }
        return next
      })
    },
    [setSearchParams]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInputValue(val)
      setActiveSuggestion(-1)

      // Determine the current "word" being typed for autocomplete
      const currentWord = val.split(/\s+/).at(-1) ?? ''
      setSuggestions(getAutocompleteSuggestions(currentWord))

      // Live-update URL so Dashboard filtering is instant
      const existingTokens = extractOperatorTokens(rawSearch)
      const newValue = [...existingTokens, val].join(' ').trim()
      commitSearch(val.includes(':') ? newValue : val)
    },
    [rawSearch, commitSearch]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (suggestions.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestion((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Enter' && activeSuggestion >= 0) {
        e.preventDefault()
        applySuggestion(suggestions[activeSuggestion].label)
      } else if (e.key === 'Escape') {
        setSuggestions([])
        setActiveSuggestion(-1)
      }
    },
    [suggestions, activeSuggestion]
  )

  const applySuggestion = useCallback(
    (label: string) => {
      // Replace the last word with the suggestion
      const words = inputValue.split(/\s+/)
      words[words.length - 1] = label
      const newVal = words.join(' ').trimStart()
      setInputValue(newVal)
      setSuggestions([])
      setActiveSuggestion(-1)
      commitSearch(newVal)
      inputRef.current?.focus()
    },
    [inputValue, commitSearch]
  )

  const handleRemoveToken = useCallback(
    (token: string) => {
      const newSearch = removeToken(rawSearch, token)
      setInputValue(newSearch)
      commitSearch(newSearch)
    },
    [rawSearch, commitSearch]
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

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (e.target.value) {
          next.set('sort', e.target.value)
        } else {
          next.delete('sort')
        }
        return next
      })
    },
    [setSearchParams]
  )

  const handleClearFilters = useCallback(() => {
    setInputValue('')
    setSuggestions([])
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  const parsedPreview = parseSearch(rawSearch)
  const hasActiveFilters =
    rawSearch || confidence !== 'all' || source !== 'all' || sort

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
            placeholder="Search by asset pair..."
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
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Search suggestions"
                className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={s.label}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={i === activeSuggestion}
                    onClick={() => applySuggestion(s.label)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                      i === activeSuggestion
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span className="font-mono text-cyan-400">{s.label}</span>
                    <span className="text-xs text-gray-500 ml-3">{s.hint}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Parsed preview */}
          {rawSearch && parsedPreview.text && operatorTokens.length > 0 && (
            <p className="mt-1 text-xs text-gray-600">
              Matching name: <span className="text-gray-400">"{parsedPreview.text}"</span>
            </p>
          )}
        </div>

        {/* Confidence dropdown */}
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

        {/* Source dropdown */}
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

        {/* Sort dropdown */}
        <div className="w-full md:w-48">
          <label htmlFor="sort" className="block text-sm font-medium text-gray-400 mb-1.5">
            Sort By
          </label>
          <select
            id="sort"
            value={sort}
            onChange={handleSortChange}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none"
          >
            <option value="">Default</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
            <option value="confidence">Confidence</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>

        {/* Clear all */}
        <div className="w-full md:w-auto">
          <button
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="w-full mt-6 md:w-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Clear all filters"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
