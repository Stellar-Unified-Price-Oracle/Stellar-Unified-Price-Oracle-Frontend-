/**
 * @file ProposedParameterDiff (#851)
 *
 * Side-by-side diff viewer for proposed governance parameter modifications.
 * Allows voters to compare current parameter registry settings against
 * proposed values before casting votes.
 *
 * Requirements satisfied:
 * - Side-by-side visual diff with optional unified mode toggle.
 * - Handles modified, newly added, and deprecated parameters.
 * - Numerical delta calculations with percentage change indicators.
 * - Explicit handling for missing or unconfigured registry values (no fabrication).
 * - Full accessibility with screen-reader labels and keyboard navigation.
 */
import { memo, useState, type ReactElement } from 'react'
import type { ProposedParameterChange } from '../types/governance'
import {
  computeParameterDelta,
  formatDiffValue,
  getDiffBadgeMeta,
  groupParameterChangesByCategory,
} from '../utils/governanceParameterDiff'

export interface ProposedParameterDiffProps {
  /** The proposed parameter modifications. */
  changes?: readonly ProposedParameterChange[] | null
  /** Proposal identifier for unique accessible IDs. */
  proposalId?: string
  /** Initial view mode: side-by-side (default) or unified. */
  initialMode?: 'side-by-side' | 'unified'
  /** Compact styling for embedding in cards. */
  compact?: boolean
}

export const ProposedParameterDiff = memo(function ProposedParameterDiff({
  changes,
  proposalId = 'proposal',
  initialMode = 'side-by-side',
  compact = false,
}: ProposedParameterDiffProps): ReactElement {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>(initialMode)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  if (!changes || changes.length === 0) {
    return (
      <div
        role="region"
        aria-label="Proposed parameter changes"
        className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-xs text-gray-500"
      >
        <p>No parameter modifications proposed in this resolution.</p>
      </div>
    )
  }

  const categoryGroups = groupParameterChangesByCategory(changes)
  const categories = Object.keys(categoryGroups)

  const displayedChanges =
    selectedCategory === 'all'
      ? changes
      : changes.filter((c) => (c.category || 'General') === selectedCategory)

  return (
    <section
      aria-label={`Proposed parameter changes for ${proposalId}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-950/60 p-4"
    >
      {/* ── Header Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
            Proposed Parameter Changes
          </span>
          <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/20">
            {changes.length} {changes.length === 1 ? 'change' : 'changes'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Category filter if multiple exist */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <label htmlFor={`${proposalId}-cat-filter`} className="text-gray-400 sr-only">
                Filter by category:
              </label>
              <select
                id={`${proposalId}-cat-filter`}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All categories ({changes.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({categoryGroups[cat].length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View mode toggle */}
          <div
            role="group"
            aria-label="Diff display style"
            className="inline-flex rounded-lg bg-gray-900 p-0.5 border border-gray-800 text-xs"
          >
            <button
              type="button"
              aria-pressed={viewMode === 'side-by-side'}
              onClick={() => setViewMode('side-by-side')}
              className={[
                'px-2.5 py-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500',
                viewMode === 'side-by-side'
                  ? 'bg-gray-800 text-cyan-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              Side-by-side
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'unified'}
              onClick={() => setViewMode('unified')}
              className={[
                'px-2.5 py-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500',
                viewMode === 'unified'
                  ? 'bg-gray-800 text-cyan-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
            >
              Unified
            </button>
          </div>
        </div>
      </div>

      {/* ── Change Items ── */}
      <ul className="flex flex-col gap-3 list-none p-0 m-0" aria-label="Parameter changes list">
        {displayedChanges.map((change) => {
          const delta = computeParameterDelta(change.currentValue, change.proposedValue)
          const badge = getDiffBadgeMeta(change.diffType)

          return (
            <li
              key={change.paramKey}
              className="flex flex-col gap-2 rounded-lg border border-gray-850 bg-gray-900/60 p-3"
            >
              {/* Item Title & Metadata */}
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-200">{change.paramName}</span>
                  <code className="text-[11px] font-mono text-cyan-400/80 bg-gray-950/70 px-1.5 py-0.5 rounded border border-gray-800">
                    {change.paramKey}
                  </code>
                  <span className="text-[11px] text-gray-500">[{change.category}]</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${badge.badgeStyle}`}
                    title={badge.srLabel}
                  >
                    <span aria-hidden="true">{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>

                  {delta && delta.direction !== 'unchanged' && (
                    <span
                      className={[
                        'text-[11px] font-mono px-2 py-0.5 rounded font-medium',
                        delta.direction === 'increase'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20',
                      ].join(' ')}
                      title={`Net change: ${delta.formattedDelta} (${delta.formattedPercent ?? 'n/a'})`}
                    >
                      {delta.formattedDelta} {delta.formattedPercent && `(${delta.formattedPercent})`}
                    </span>
                  )}
                </div>
              </div>

              {/* Rationale if present */}
              {change.rationale && (
                <p className="text-xs text-gray-400 italic bg-gray-950/40 p-2 rounded border border-gray-850">
                  {change.rationale}
                </p>
              )}

              {/* ── Side-by-side View ── */}
              {viewMode === 'side-by-side' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {/* Current Value Column */}
                  <div className="flex flex-col gap-1 rounded-md border border-red-500/20 bg-red-950/15 p-2.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-red-400 flex items-center justify-between">
                      <span>Current Registry Value</span>
                      <span className="sr-only">Old value:</span>
                    </span>
                    <div className="font-mono text-gray-300 break-all text-xs pt-0.5">
                      {change.currentValue !== null ? (
                        <span className={change.diffType === 'remove' || change.diffType === 'modify' ? 'line-through text-red-300/80' : undefined}>
                          {formatDiffValue(change.currentValue, change.unit)}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">None (new parameter)</span>
                      )}
                    </div>
                  </div>

                  {/* Proposed Value Column */}
                  <div className="flex flex-col gap-1 rounded-md border border-green-500/20 bg-green-950/15 p-2.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-green-400 flex items-center justify-between">
                      <span>Proposed Governance Value</span>
                      <span className="sr-only">New value:</span>
                    </span>
                    <div className="font-mono text-gray-100 font-semibold break-all text-xs pt-0.5">
                      {change.proposedValue !== null ? (
                        <span className="text-green-300">
                          {formatDiffValue(change.proposedValue, change.unit)}
                        </span>
                      ) : (
                        <span className="text-red-400 italic">Deprecated (removed)</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Unified / Inline View ── */}
              {viewMode === 'unified' && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-800 bg-gray-950 p-2 text-xs font-mono">
                  <span className="sr-only">From:</span>
                  <span
                    className={[
                      'px-2 py-0.5 rounded',
                      change.currentValue !== null
                        ? 'bg-red-950/40 text-red-300 line-through border border-red-500/30'
                        : 'text-gray-500 italic',
                    ].join(' ')}
                  >
                    {change.currentValue !== null
                      ? formatDiffValue(change.currentValue, change.unit)
                      : 'None'}
                  </span>
                  <span className="text-gray-500" aria-hidden="true">
                    →
                  </span>
                  <span className="sr-only">To:</span>
                  <span
                    className={[
                      'px-2 py-0.5 rounded font-semibold',
                      change.proposedValue !== null
                        ? 'bg-green-950/40 text-green-300 border border-green-500/30'
                        : 'text-red-400 italic',
                    ].join(' ')}
                  >
                    {change.proposedValue !== null
                      ? formatDiffValue(change.proposedValue, change.unit)
                      : 'Removed'}
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
})
