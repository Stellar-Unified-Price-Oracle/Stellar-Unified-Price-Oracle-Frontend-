import { useState, useCallback } from 'react'
import type { PriceData } from '../types'
import { formatPrice, timeAgo } from '../utils/format'

type SortKey = 'assetPair' | 'price' | 'change' | 'confidence' | 'sources' | 'timestamp'
type SortDir = 'asc' | 'desc'

interface PriceTableProps {
  prices: PriceData[]
  livePairs: Set<string>
  isStale?: boolean
  onRowClick: (pair: string) => void
  onAlertClick: (e: React.MouseEvent, pair: string) => void
  hasAlert: (pair: string) => boolean
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 inline-flex flex-col gap-px opacity-60" aria-hidden="true">
      <svg
        className={`w-2.5 h-2.5 transition-opacity ${active && dir === 'asc' ? 'opacity-100' : 'opacity-30'}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 0L10 6H0z" />
      </svg>
      <svg
        className={`w-2.5 h-2.5 transition-opacity ${active && dir === 'desc' ? 'opacity-100' : 'opacity-30'}`}
        viewBox="0 0 10 6"
        fill="currentColor"
      >
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  )
}

export function PriceTable({ prices, livePairs, isStale, onRowClick, onAlertClick, hasAlert }: PriceTableProps) {
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

  const sorted = [...prices].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'assetPair') cmp = a.assetPair.localeCompare(b.assetPair)
    else if (sortKey === 'price') cmp = a.price - b.price
    else if (sortKey === 'confidence') cmp = a.confidence - b.confidence
    else if (sortKey === 'sources') cmp = a.sources.length - b.sources.length
    else if (sortKey === 'timestamp') cmp = a.timestamp - b.timestamp
    return sortDir === 'asc' ? cmp : -cmp
  })

  const thClass =
    'px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap'

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800 shadow-lg shadow-black/20">
      <table className="min-w-full text-sm" aria-label="Price feeds table">
        <thead className="bg-gray-900 sticky top-0 z-10">
          <tr>
            {(
              [
                ['assetPair', 'Pair'],
                ['price', 'Price'],
                ['confidence', 'Confidence'],
                ['sources', 'Sources'],
                ['timestamp', 'Updated'],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <th
                key={key}
                className={thClass}
                onClick={() => handleSort(key)}
                aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span className="inline-flex items-center">
                  {label}
                  <SortIcon active={sortKey === key} dir={sortDir} />
                </span>
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
              Alert
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {sorted.map((p) => {
            const live = livePairs.has(p.assetPair)
            const alertSet = hasAlert(p.assetPair)
            return (
              <tr
                key={p.assetPair}
                onClick={() => onRowClick(p.assetPair)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick(p.assetPair)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${p.assetPair}`}
                className={`bg-gray-900 hover:bg-gray-800 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${isStale ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 font-semibold text-gray-100 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {p.assetPair}
                    {live && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
                        role="status"
                        aria-label="Live data"
                      />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-100 whitespace-nowrap">${formatPrice(p.price)}</td>
                <td className="px-4 py-3 text-cyan-400 whitespace-nowrap">{(p.confidence * 100).toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <span className="text-gray-400">{p.sources.join(', ')}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{timeAgo(p.timestamp)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAlertClick(e, p.assetPair)
                    }}
                    className={`text-xs font-medium transition-colors ${alertSet ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}
                    aria-label={`Set alert for ${p.assetPair}`}
                  >
                    {alertSet ? 'Alert set' : 'Set alert'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
