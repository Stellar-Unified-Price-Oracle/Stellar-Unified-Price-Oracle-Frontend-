/**
 * AggregationBreakdownPanel (#459)
 *
 * Visualises how the oracle aggregate price is built from individual source
 * prices, weights, and contributions.  Renders:
 * - Active aggregation mode badge (weighted mean | median | outlier-excluded)
 * - Algorithm parameters (e.g. z-score threshold for outlier mode)
 * - Per-source table: source name, reported price, weight %, contribution,
 *   "excluded" indicator
 * - Weighted-mean step: Σ(price × weight) = aggregate
 * - Contribution bar visualising each source's relative share
 */
import { useMemo, useState } from 'react'
import { formatPrice } from '../utils/format'
import { SOURCE_COLORS } from '../utils/sourceColors'
import type { AggregationBreakdown, AggregationMode } from '../types/price'

// ── Mode badge ────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<AggregationMode, string> = {
  weighted_mean: 'Weighted Mean',
  median: 'Median',
  outlier_excluded: 'Outlier-Excluded Mean',
}

const MODE_DESCRIPTIONS: Record<AggregationMode, string> = {
  weighted_mean:
    'Each oracle source contributes its price multiplied by its assigned weight. The aggregate is the sum of all weighted contributions.',
  median:
    'The aggregate is the middle value when all source prices are sorted. More robust to outliers but ignores source reliability weights.',
  outlier_excluded:
    'Sources whose price deviates beyond the z-score threshold are excluded before computing the weighted mean of the remaining sources.',
}

function ModeBadge({ mode }: { mode: AggregationMode }) {
  const colours: Record<AggregationMode, string> = {
    weighted_mean: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    median: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    outlier_excluded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${colours[mode]}`}
    >
      {MODE_LABELS[mode]}
    </span>
  )
}

// ── Contribution bar ──────────────────────────────────────────────────────────

function ContributionBar({
  source,
  weight,
  excluded,
}: {
  source: string
  weight: number
  excluded: boolean
}) {
  const pct = (weight * 100).toFixed(1)
  const colorClass = excluded
    ? 'bg-gray-700'
    : SOURCE_COLORS[source]?.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-cyan-500/40'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${colorClass}`}
          style={{ width: `${excluded ? 0 : weight * 100}%` }}
          aria-valuenow={excluded ? 0 : parseFloat(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
          aria-label={`${source} weight`}
        />
      </div>
      <span className={`text-xs tabular-nums w-10 text-right ${excluded ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
        {excluded ? '—' : `${pct}%`}
      </span>
    </div>
  )
}

// ── Step-by-step formula ──────────────────────────────────────────────────────

function WeightedMeanSteps({ breakdown }: { breakdown: AggregationBreakdown }) {
  const active = breakdown.sources.filter((s) => !s.excluded)
  if (active.length === 0) return null

  return (
    <div className="mt-4 bg-gray-800/60 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
      <p className="text-gray-500 mb-2 font-sans text-[11px] uppercase tracking-wider">
        Calculation steps
      </p>
      {active.map((item, i) => (
        <div key={item.source} className="flex flex-wrap gap-x-2 leading-6">
          <span className={SOURCE_COLORS[item.source]?.split(' ').find((c) => c.startsWith('text-')) ?? 'text-gray-300'}>
            {item.source}
          </span>
          <span className="text-gray-500">
            {i === 0 ? '=' : '+'} ${formatPrice(item.price)} × {(item.weight * 100).toFixed(1)}%
          </span>
          <span className="text-gray-600">= ${formatPrice(item.contribution)}</span>
        </div>
      ))}
      <div className="border-t border-gray-700 mt-2 pt-2 flex flex-wrap gap-x-2">
        <span className="text-gray-400">Aggregate</span>
        <span className="text-cyan-400 font-semibold">= ${formatPrice(breakdown.aggregatePrice)}</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface AggregationBreakdownPanelProps {
  breakdown: AggregationBreakdown
}

export function AggregationBreakdownPanel({ breakdown }: AggregationBreakdownPanelProps) {
  const [showSteps, setShowSteps] = useState(false)

  const excludedCount = useMemo(
    () => breakdown.sources.filter((s) => s.excluded).length,
    [breakdown.sources],
  )

  return (
    <section aria-labelledby="aggregation-breakdown-heading">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <ModeBadge mode={breakdown.mode} />
        {excludedCount > 0 && (
          <span className="text-xs text-amber-400/80">
            {excludedCount} source{excludedCount > 1 ? 's' : ''} excluded as outlier
            {excludedCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Mode description */}
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        {MODE_DESCRIPTIONS[breakdown.mode]}
        {breakdown.mode === 'outlier_excluded' && typeof breakdown.params['zScoreThreshold'] === 'number' && (
          <span className="ml-1 text-amber-400/70">
            (z-score threshold: {breakdown.params['zScoreThreshold']})
          </span>
        )}
      </p>

      {/* Per-source table */}
      <div
        className="overflow-x-auto rounded-lg border border-gray-800"
        role="region"
        aria-label="Per-source aggregation breakdown"
      >
        <table className="w-full text-sm border-collapse" aria-label="Aggregation breakdown table">
          <thead>
            <tr className="bg-gray-800/80">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Weight
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Contribution
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.sources.map((item) => (
              <tr
                key={item.source}
                className={`border-t border-gray-800 transition-colors ${
                  item.excluded ? 'opacity-40' : 'hover:bg-gray-800/40'
                }`}
                aria-disabled={item.excluded}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${
                        SOURCE_COLORS[item.source] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {item.source}
                    </span>
                    {item.excluded && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-semibold uppercase tracking-wide">
                        excluded
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-200">
                  ${formatPrice(item.price)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {item.excluded ? (
                    <span className="text-gray-600 line-through">{(item.weight * 100).toFixed(1)}%</span>
                  ) : (
                    `${(item.weight * 100).toFixed(1)}%`
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {item.excluded ? (
                    <span className="text-gray-600">—</span>
                  ) : (
                    `$${formatPrice(item.contribution)}`
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell w-40">
                  <ContributionBar
                    source={item.source}
                    weight={item.weight}
                    excluded={item.excluded}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {/* Aggregate total row */}
          <tfoot>
            <tr className="border-t-2 border-gray-700 bg-gray-800/60">
              <td className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Aggregate
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-cyan-400">
                ${formatPrice(breakdown.aggregatePrice)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-400">100%</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-cyan-400">
                ${formatPrice(breakdown.aggregatePrice)}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Step-by-step calculation (weighted mean / outlier-excluded only) */}
      {(breakdown.mode === 'weighted_mean' || breakdown.mode === 'outlier_excluded') && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            aria-expanded={showSteps}
            aria-controls="aggregation-steps"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showSteps ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showSteps ? 'Hide' : 'Show'} calculation steps
          </button>
          {showSteps && (
            <div id="aggregation-steps">
              <WeightedMeanSteps breakdown={breakdown} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
