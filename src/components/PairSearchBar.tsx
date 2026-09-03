import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { sanitizeSearchInput } from '../utils/sanitize'
import { useSearchRateLimit } from '../hooks/useSearchRateLimit'

const MAX_RECENT = 5
const RECENT_KEY = 'pairSearchRecent'

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveRecent(pair: string, current: string[]): string[] {
  const next = [pair, ...current.filter((p) => p !== pair)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
  return next
}

/** Simple fuzzy match: every char of `query` appears in `target` in order. */
function fuzzyMatch(target: string, query: string): boolean {
  const t = target.toLowerCase()
  const q = query.toLowerCase()
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti)
    if (found === -1) return false
    ti = found + 1
  }
  return true
}

export interface PairSearchBarProps {
  /** All available pairs (e.g. ["XLM/USD", "BTC/USD", …]) */
  pairs: string[]
  /** All oracle sources across all pairs */
  allSources: string[]
  /** Current search value */
  value: string
  /** Called when the user selects or types a search value */
  onChange: (value: string) => void
  className?: string
}

export const PairSearchBar = memo(function PairSearchBar({
  pairs,
  allSources,
  value,
  onChange,
  className = '',
}: PairSearchBarProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Debounce + rate-limit the search value (max 1 per 100 ms) so that
  // the expensive fuzzy-filter only runs on the debounced input.
  const { debouncedValue } = useSearchRateLimit(value)

  // Suggestions: fuzzy-match pairs by name, base asset, or quote asset
  const suggestions = useMemo(() => {
    if (!debouncedValue && !sourceFilter) return []
    return pairs.filter((p) => {
      const matchesText = !debouncedValue || fuzzyMatch(p, debouncedValue)
      return matchesText
    })
  }, [pairs, debouncedValue, sourceFilter])

  const items: string[] = value || sourceFilter ? suggestions : recent

  const handleSelect = useCallback(
    (item: string) => {
      onChange(item)
      setRecent((r) => saveRecent(item, r))
      setOpen(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
    },
    [onChange],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitised = sanitizeSearchInput(e.target.value)
      onChange(sanitised)
      setOpen(true)
      setActiveIndex(-1)
    },
    [onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setOpen(true)
        }
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && items[activeIndex]) {
          handleSelect(items[activeIndex])
        } else {
          setOpen(false)
        }
      } else if (e.key === 'Escape') {
        setOpen(false)
        setActiveIndex(-1)
      }
    },
    [open, items, activeIndex, handleSelect],
  )

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const li = listRef.current.children[activeIndex] as HTMLElement | undefined
      li?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        inputRef.current &&
        !inputRef.current.closest('[data-pairsearch]')?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const listboxId = 'pair-search-listbox'

  return (
    <div data-pairsearch className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `pair-opt-${activeIndex}` : undefined}
            placeholder="Search pairs…"
            value={value}
            onChange={handleChange}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-700 bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Search asset pairs"
          />
          {/* search icon */}
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Source filter dropdown */}
        {allSources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setOpen(true) }}
            className="py-1.5 px-2 text-sm rounded-lg border border-gray-700 bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Filter by oracle source"
          >
            <option value="">All sources</option>
            {allSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {open && items.length > 0 && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-label="Pair suggestions"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-56 py-1"
        >
          {!value && recent.length > 0 && (
            <li className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold" role="presentation">
              Recent searches
            </li>
          )}
          {value && suggestions.length > 0 && (
            <li className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold" role="presentation">
              Pairs
            </li>
          )}
          {items.map((item, i) => {
            const [base, quote] = item.split('/')
            return (
              <li
                key={item}
                id={`pair-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors ${
                  i === activeIndex
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-gray-200 hover:bg-gray-700'
                }`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  handleSelect(item)
                }}
              >
                <span className="font-medium">{item}</span>
                <span className="text-xs text-gray-500">
                  {base} / {quote}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})
