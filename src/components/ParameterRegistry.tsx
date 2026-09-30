/**
 * @file ParameterRegistry — Transparent parameter registry (#698).
 *
 * Displays all tuneable oracle parameters grouped by category. Each entry
 * shows the current value, owner, last-updated time, and a toggle to reveal
 * the full change history for that parameter.
 *
 * Trust rules:
 * - Values are shown verbatim from the API; no inference or back-filling.
 * - Load failures are distinguished from "empty registry" — never show zero
 *   parameters when the fetch failed.
 */
import { memo, useState, type ReactElement } from 'react'
import { useSwr } from '../hooks/useSwr'
import { fetchParameterRegistry, fetchParameterHistory } from '../api/rest'
import type { ParameterEntry, ParameterChangeLogEntry } from '../types'
import { groupParametersByCategory, formatChangeLogEntry } from '../utils/governance'

// ── Change history drawer ─────────────────────────────────────────────────────

interface ChangeHistoryProps {
  paramKey: string
}

function ChangeHistory({ paramKey }: ChangeHistoryProps): ReactElement {
  const { data, loading, error } = useSwr(
    `governance/parameters/${paramKey}/history`,
    (signal) => fetchParameterHistory(paramKey, signal),
    { staleTime: 120_000 },
  )

  if (loading) {
    return (
      <p className="text-xs text-gray-500 mt-2" role="status">
        Loading history…
      </p>
    )
  }
  if (error !== null) {
    return (
      <p role="alert" className="text-xs text-red-400 mt-2">
        Could not load change history.
      </p>
    )
  }
  if (!data || data.length === 0) {
    return <p className="text-xs text-gray-500 mt-2">No change history recorded.</p>
  }

  return (
    <ol className="mt-2 flex flex-col gap-2 list-none p-0" aria-label={`Change history for ${paramKey}`}>
      {data.map((entry: ParameterChangeLogEntry, i: number) => {
        const { label, changedAtDisplay } = formatChangeLogEntry(entry)
        return (
          <li key={i} className="text-xs text-gray-400 border-l-2 border-gray-700 pl-3 flex flex-col gap-0.5">
            <span className="text-gray-500">{changedAtDisplay}</span>
            <span>
              <span className="font-mono text-red-400 line-through">{entry.previousValue}</span>
              {' → '}
              <span className="font-mono text-green-400">{entry.nextValue}</span>
            </span>
            <span className="text-gray-500">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Single parameter row ──────────────────────────────────────────────────────

interface ParameterRowProps {
  entry: ParameterEntry
}

const ParameterRow = memo(function ParameterRow({ entry }: ParameterRowProps): ReactElement {
  const [showHistory, setShowHistory] = useState(false)
  const updatedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(entry.updatedAt),
  )

  return (
    <li className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5 min-w-0">
          <code className="text-sm font-mono text-indigo-300 break-all">{entry.key}</code>
          <p className="text-xs text-gray-400">{entry.description}</p>
        </div>
        <code className="text-sm font-mono text-gray-100 bg-gray-800 px-2 py-1 rounded shrink-0 max-w-xs break-all">
          {entry.value}
        </code>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 flex-wrap">
        <span>
          Owner: <span className="text-gray-300">{entry.owner}</span>
        </span>
        <span>Last updated: {updatedDate}</span>
      </div>

      <button
        type="button"
        onClick={() => setShowHistory((s) => !s)}
        aria-expanded={showHistory}
        className="self-start text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline-offset-2 hover:underline"
      >
        {showHistory ? 'Hide history' : 'View change history'}
      </button>

      {showHistory && <ChangeHistory paramKey={entry.key} />}
    </li>
  )
})

// ── Main component ────────────────────────────────────────────────────────────

export function ParameterRegistry(): ReactElement {
  const {
    data,
    loading,
    error,
    refetch,
  } = useSwr('governance/parameters', (signal) => fetchParameterRegistry(signal), {
    refreshInterval: 120_000,
    staleTime: 60_000,
  })

  const groups = data ? groupParametersByCategory(data) : null

  return (
    <section aria-labelledby="param-registry-heading" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="param-registry-heading" className="text-lg font-semibold text-gray-100">
          Parameter registry
        </h2>
        {!loading && error === null && data && (
          <span className="text-xs text-gray-500">
            {data.length} parameter{data.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        All tuneable oracle parameters — thresholds, weights, timeouts, and budgets — are listed here with their
        current owner and full change history. Values are verbatim from the API; nothing is inferred client-side.
      </p>

      {loading && !data && (
        <p className="text-sm text-gray-500 py-6 text-center" role="status">
          Loading parameters…
        </p>
      )}

      {!loading && error !== null && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex flex-col items-start gap-3"
        >
          <p className="text-sm text-red-300">
            Could not load the parameter registry. This is a load failure — not a report that no parameters are
            configured.
          </p>
          <button
            type="button"
            onClick={refetch}
            className="min-h-[44px] px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && error === null && (!data || data.length === 0) && (
        <p className="text-sm text-gray-500 py-6 text-center">The registry API returned no parameters.</p>
      )}

      {groups && groups.size > 0 && (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([category, entries]) => (
            <div key={category} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{category}</h3>
              <ul className="flex flex-col gap-3 list-none p-0">
                {entries.map((entry) => (
                  <ParameterRow key={entry.key} entry={entry} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
