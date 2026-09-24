import { memo, useState, useCallback } from 'react'
import type { PriceHistoryEntry } from '../types'
import { formatPrice, formatTimestamp } from '../utils/format'

type SortKey = 'timestamp' | 'price' | 'confidence'
type SortDir = 'asc' | 'desc'

interface PriceHistoryTableProps {
  data: PriceHistoryEntry[]
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'price', label: 'Price' },
  { key: 'confidence', label: 'Confidence' },
]

export const PriceHistoryTable = memo(function PriceHistoryTable({ data }: PriceHistoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500" role="status">
        No price history available yet.
      </p>
    )
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'timestamp') cmp = a.timestamp - b.timestamp
    else if (sortKey === 'price') cmp = a.price - b.price
    else if (sortKey === 'confidence') cmp = a.confidence - b.confidence
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-96 rounded-xl border border-gray-800">
      <table className="min-w-full text-sm" aria-label="Price history table">
        <thead>
          <tr className="sticky top-0 bg-gray-900 border-b border-gray-800">
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
              Sources
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.timestamp} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatTimestamp(entry.timestamp)}</td>
              <td className="px-4 py-3 font-mono text-gray-100 whitespace-nowrap">${formatPrice(entry.price)}</td>
              <td className="px-4 py-3 text-cyan-400 whitespace-nowrap">{(entry.confidence * 100).toFixed(1)}%</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-gray-400">{entry.sources.join(', ')}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
