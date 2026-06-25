import { memo } from 'react'
import type { PriceData, PriceSyncState } from '../types'
import { formatPrice, timeAgo } from '../utils/format'

const SOURCE_COLORS: Record<string, string> = {
  chainlink: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  redstone: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  band: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  reflector: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
}

interface PriceCardProps {
  price: PriceData
  onClick?: () => void
  isLive?: boolean
  isStale?: boolean
  syncState?: PriceSyncState
  flashVersion?: number
  isValidating?: boolean
  hasAlert?: boolean
  onAlertClick?: (e: React.MouseEvent) => void
  selectMode?: boolean
  isSelected?: boolean
}

export const PriceCard = memo(function PriceCard({ price, onClick, isStale, hasAlert, onAlertClick, selectMode, isSelected }: PriceCardProps) {
  const confidencePct = (price.confidence * 100).toFixed(1)

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      role="button"
      tabIndex={0}
      className={`w-full text-left bg-gray-900 border rounded-xl p-5 hover:border-gray-700 hover:bg-gray-900/80 transition-all shadow-lg shadow-black/20 cursor-pointer ${isStale ? 'opacity-60' : ''} ${isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/40' : 'border-gray-800'}`}
      aria-label={`View details for ${price.assetPair}`}
      aria-selected={selectMode ? isSelected : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <span
              className={`w-4 h-4 flex items-center justify-center rounded border ${isSelected ? 'bg-cyan-600 border-cyan-500' : 'border-gray-600'}`}
              aria-hidden="true"
            >
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          ) : null}
          <h2 className="text-lg font-semibold text-gray-100">{price.assetPair}</h2>
        </div>
      </div>

      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-3 font-mono tracking-tight">
        ${formatPrice(price.price)}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-3">
        <span>Updated {timeAgo(price.timestamp)}</span>
        <span className="text-cyan-600 dark:text-cyan-400">{confidencePct}% confidence</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {price.sources.map((src) => (
          <span
            key={src}
            className={`px-2 py-0.5 rounded text-xs font-medium border ${SOURCE_COLORS[src] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}
          >
            {src}
          </span>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAlertClick?.(e)
          }}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${hasAlert ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label={`Set alert for ${price.assetPair}`}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
            />
          </svg>
          {hasAlert ? 'Alert set' : 'Set alert'}
        </button>
      </div>
    </div>
  )
})
