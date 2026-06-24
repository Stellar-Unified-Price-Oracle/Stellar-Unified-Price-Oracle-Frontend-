import { memo, useState, useCallback } from 'react'
import type { PriceData } from '../types'
import { formatPrice, timeAgo } from '../utils/format'

type SortKey = 'assetPair' | 'price' | 'confidence' | 'sources' | 'timestamp'
type SortDir = 'asc' | 'desc'

interface PriceTableViewProps {
  items: PriceData[]
  livePairs: Set<string>
  isStale?: boolean
  onRowClick: (pair: string) => void
  onAlertClick: (e: React.MouseEvent, pair: string) => void
  hasAlertFn: (pair: string) => boolean
  selectMode?: boolean
  selected?: Set<string>
  onToggleSelect?: (pair: string) => void
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'assetPair', label: 'Pair' },
  { key: 'price', label: 'Price' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'sources', label: 'Sources' },
  { key: 'timestamp', label: 'Updated' },
]

export const PriceTableView = memo(function PriceTableView({
  items,
  livePairs,
  isStale,
  onRowClick,
  onAlertClick,
  hasAlertFn,
  selectMode,
  selected,
  onToggleSelect,
}: PriceTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('assetPair')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey],
  )

  const sorted = [...items].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'assetPair') cmp = a.assetPair.localeCompare(b.assetPair)
    else if (sortKey === 'price') cmp = a.price - b.price
    else if (sortKey === 'confidence') cmp = a.confidence - b.confidence
    else if (sortKey === 'sources') cmp = a.sources.length - b.sources.length
    else if (sortKey === 'timestamp') cmp = a.timestamp - b.timestamp
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="min-w-full text-sm" aria-label="Price feeds table">
        <thead>
          <tr className="sticky top-0 bg-gray-900 border-b border-gray-800">
            {selectMode && (
              <th scope="col" className="px-4 py-3 w-10">
                <span className="sr-only">Select</span>
              </th>
            )}
            {COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                scope="col"
                onClick={() => handleSort(key)}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-200 transition-colors"
                aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span className="flex items-center gap-1">
                  {label}
                  {sortKey === key ? (
                    <span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  ) : (
                    <span className="text-gray-700" aria-hidden="true">↕</span>
                  )}
                </span>
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
              Alert
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const isLive = livePairs.has(p.assetPair)
            const hasAlert = hasAlertFn(p.assetPair)
            const isSelected = selected?.has(p.assetPair) ?? false
            return (
              <tr
                key={p.assetPair}
                onClick={() => { if (selectMode) { onToggleSelect?.(p.assetPair) } else { onRowClick(p.assetPair) } }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (selectMode) { onToggleSelect?.(p.assetPair) } else { onRowClick(p.assetPair) }
                  }
                }}
                role="button"
                tabIndex={0}
                className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors ${isStale ? 'opacity-60' : ''} ${isSelected ? 'bg-cyan-900/20' : ''}`}
                aria-label={`View details for ${p.assetPair}`}
                aria-selected={selectMode ? isSelected : undefined}
              >
                {selectMode && (
                  <td className="px-4 py-3 w-10">
                    <span
                      className={`inline-flex w-4 h-4 items-center justify-center rounded border ${isSelected ? 'bg-cyan-600 border-cyan-500' : 'border-gray-600'}`}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 font-semibold text-gray-100 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {p.assetPair}
                    {isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" role="status" aria-label="Live data" />
                    )}
                    {hasAlert && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" role="status" aria-label="Active alert" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-100 whitespace-nowrap">${formatPrice(p.price)}</td>
                <td className="px-4 py-3 text-cyan-400 whitespace-nowrap">{(p.confidence * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-gray-400">{p.sources.join(', ')}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{timeAgo(p.timestamp)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAlertClick(e, p.assetPair)
                    }}
                    className={`text-xs font-medium transition-colors ${hasAlert ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}
                    aria-label={`Set alert for ${p.assetPair}`}
                  >
                    {hasAlert ? 'Alert set' : 'Set alert'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
