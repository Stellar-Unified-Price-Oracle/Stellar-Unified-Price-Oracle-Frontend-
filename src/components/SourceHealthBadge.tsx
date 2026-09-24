/**
 * @file SourceHealthBadge
 *
 * Renders a row of coloured pill badges indicating which oracle sources
 * (Chainlink, Redstone, Band, Reflector) contributed to a price update.
 *
 * @example With multiple sources
 * ```tsx
 * <SourceHealthBadge sources={['chainlink', 'redstone', 'band']} />
 * ```
 *
 * @example Empty — while aggregator is initialising
 * ```tsx
 * <SourceHealthBadge sources={[]} />
 * // renders: "No sources"
 * ```
 *
 * ## Props table
 * | prop      | type               | required | description                           |
 * |-----------|--------------------|----------|---------------------------------------|
 * | `sources` | `readonly string[]`| yes      | Oracle identifiers for the price feed |
 *
 * ## Edge cases
 * - **Empty array** — renders a muted "No sources" fallback span.
 * - **Unknown source key** — sources not in `SOURCE_INFO` are silently skipped
 *   (`null` returned from the map). Add new oracles to `SOURCE_INFO` to show them.
 *
 * ## Accessibility
 * - Each pill is a plain `<span>` (non-interactive). Surrounding context (e.g. a
 *   table cell or card) provides the accessible label for the row.
 * - The coloured dot inside each pill is decorative; the source name text conveys
 *   the same meaning to screen readers.
 */
import { memo, type ReactElement } from 'react'
const SOURCE_INFO: Record<string, { label: string; color: string }> = {
  chainlink: { label: 'Chainlink', color: 'bg-blue-500' },
  redstone: { label: 'Redstone', color: 'bg-red-500' },
  band: { label: 'Band', color: 'bg-purple-500' },
  reflector: { label: 'Reflector', color: 'bg-cyan-500' },
}

interface SourceHealthProps {
  sources: readonly string[]
}

export const SourceHealthBadge = memo(function SourceHealthBadge({ sources }: SourceHealthProps): ReactElement {
  if (!sources.length) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">No sources</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((src) => {
        const info = SOURCE_INFO[src]
        if (!info) return null
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${info.color}`} />
            {info.label}
          </span>
        )
      })}
    </div>
  )
})
