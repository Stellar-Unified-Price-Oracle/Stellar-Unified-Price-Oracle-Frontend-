/**
 * @file PriceCard
 *
 * Displays a single aggregated price feed for an asset pair.
 *
 * @example Basic usage
 * ```tsx
 * <PriceCard price={priceData} onClick={handleCardClick} />
 * ```
 *
 * @example With alert button active
 * ```tsx
 * <PriceCard
 *   price={priceData}
 *   hasAlert
 *   onAlertClick={handleAlertClick}
 *   onClick={handleCardClick}
 * />
 * ```
 *
 * @example In multi-select mode
 * ```tsx
 * <PriceCard
 *   price={priceData}
 *   selectMode
 *   isSelected={selectedPairs.has(priceData.assetPair)}
 *   onClick={handleToggleSelect}
 * />
 * ```
 *
 * ## Edge cases
 * - **Stale data** — when `isStale` is `true`, the card renders at 60 % opacity to
 *   signal the feed is behind the freshness threshold (configurable via preferences).
 * - **No sources** — `price.sources` may be empty while the aggregator is initialising;
 *   in that case the source badge row is blank.
 * - **Unknown source** — sources not in `SOURCE_COLORS` fall back to a neutral grey pill.
 * - **Memoization trap** — do not pass `onClick={() => doSomething(pair)}` (new closure
 *   per render). Pass the handler directly and let the card call it with `assetPair`.
 *   See the memoization convention in `AGENTS.md`.
 *
 * ## Accessibility
 * - Root element has `role="button"` and `tabIndex={0}` for keyboard activation.
 * - `aria-label` describes the pair (e.g. "BTC/USD price card").
 * - `aria-selected` is set only when `selectMode` is active.
 * - The alert SVG icon carries `aria-hidden="true"` so screen readers skip it.
 * - Source badge tooltips are keyboard-focusable via the `Tooltip` wrapper.
 */
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { PriceData, PriceSyncState } from '../types'
import { formatPrice } from '../utils/format'
import { usePreferences } from '../preferences/PreferencesContext'
import { useActiveSource } from '../hooks/useActiveSource'
import { FreshnessBadge } from './FreshnessBadge'
import { Tooltip } from './Tooltip'

const SOURCE_COLORS: Record<string, string> = {
  chainlink: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  redstone: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  band: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  reflector: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
}

/** Props for {@link PriceCard}. */
interface PriceCardProps {
  /** The price data to display. */
  price: PriceData
  /**
   * Called when the card is clicked or activated via keyboard.
   *
   * Receives the asset pair so callers can pass one stable handler for the whole list
   * instead of allocating a closure per card, which would defeat this component's
   * `memo`. See the memoization convention in `AGENTS.md`.
   */
  onClick?: (assetPair: string) => void
  /** Whether the price value is currently being updated over WebSocket (reserved for future flash animation). */
  isLive?: boolean
  /** When `true` the card is rendered at reduced opacity to indicate the data may be outdated. */
  isStale?: boolean
  /** Optimistic update sync state (reserved for future visual indicators). */
  syncState?: PriceSyncState
  /** Increments on each WebSocket update to trigger CSS flash animations. */
  flashVersion?: number
  /** Whether a background REST revalidation is in progress. */
  isValidating?: boolean
  /** When `true` shows the alert button in its active (amber) state. */
  hasAlert?: boolean
  /**
   * Called when the alert button is clicked. Receives the raw mouse event so callers
   * can stop propagation, plus the asset pair for the same reason as {@link PriceCardProps.onClick}.
   */
  onAlertClick?: (e: React.MouseEvent, assetPair: string) => void
  /** When `true` the card renders in multi-select mode, showing a checkbox. */
  selectMode?: boolean
  /** Whether this card is currently selected in multi-select mode. */
  isSelected?: boolean
}

export const PriceCard = memo(function PriceCard({ price, onClick, isStale, hasAlert, onAlertClick, selectMode, isSelected }: PriceCardProps) {
  const { t } = useTranslation()
  const { preferences } = usePreferences()
  const confidencePct = (price.confidence * 100).toFixed(1)
  const { assetPair } = price
  const activeSource = useActiveSource(assetPair, price.sources, preferences.sourcePriority)

  const handleClick = useCallback(() => onClick?.(assetPair), [onClick, assetPair])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick?.(assetPair)
      }
    },
    [onClick, assetPair],
  )

  const handleAlertClick = useCallback(
    (e: React.MouseEvent) => {
      // Keep the click off the card body, which navigates to the detail page.
      e.stopPropagation()
      onAlertClick?.(e, assetPair)
    },
    [onAlertClick, assetPair],
  )

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`w-full text-left bg-gray-900 border rounded-xl p-5 hover:border-gray-700 hover:bg-gray-900/80 transition-all shadow-lg shadow-black/20 cursor-pointer ${isStale ? 'opacity-60' : ''} ${isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/40' : 'border-gray-800'}`}
      aria-label={t('priceCard.ariaLabel', { pair: price.assetPair })}
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
        <FreshnessBadge timestamp={price.timestamp} refreshIntervalMs={preferences.refreshInterval} />
        <Tooltip content={t('priceCard.confidenceTooltip')}>
          <span className="text-cyan-600 dark:text-cyan-400">
            {t('priceCard.confidence', { value: confidencePct })}
          </span>
        </Tooltip>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {price.sources.map((src) => (
          <Tooltip
            key={src}
            content={
              src === activeSource
                ? `Active source (highest priority available)`
                : t(`sources.${src as 'chainlink' | 'redstone' | 'band' | 'reflector'}`, {
                    defaultValue: t('sources.defaultTooltip', { source: src }),
                  })
            }
          >
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${SOURCE_COLORS[src] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'} ${src === activeSource ? 'ring-1 ring-cyan-400' : ''}`}
            >
              {src === activeSource && <span aria-hidden="true">● </span>}
              {src}
            </span>
          </Tooltip>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800">
        <button
          type="button"
          onClick={handleAlertClick}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${hasAlert ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label={t('priceCard.alertAriaLabel', { pair: price.assetPair })}
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
          {hasAlert ? t('priceCard.alertSet') : t('priceCard.setAlert')}
        </button>
      </div>
    </div>
  )
})
