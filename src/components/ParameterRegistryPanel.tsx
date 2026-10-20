/**
 * @file ParameterRegistryPanel (#698, #852)
 *
 * Displays all registered system parameters with their current value, owner,
 * last-changed timestamp, and full change history. Organised by category.
 *
 * Features (#852):
 * - Subscribe/watch individual parameters.
 * - Persistent subscription state across sessions.
 * - Change detection banner and toast notifications when watched parameters update.
 * - Filter toggle between "All parameters" and "Watched" parameters.
 *
 * Rendering rules:
 * - Never render a fabricated value. Null → explicit "not reported" text.
 * - History is shown oldest-first (as the API delivers it).
 * - Recently-changed parameters (within 24 h) get a highlight badge.
 */
import { memo, useState, type ReactElement } from 'react'
import type { ParameterRecord, ParameterChangeEntry } from '../types'
import {
  groupByCategory,
  latestChange,
  changedRecently,
  formatParameterValue,
  searchParameters,
} from '../utils/parameterRegistry'
import { VerifiableLedgerLink } from './VerifiableLedgerLink'

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

interface ChangeEntryRowProps {
  entry: ParameterChangeEntry
}

const ChangeEntryRow = memo(function ChangeEntryRow({ entry }: ChangeEntryRowProps): ReactElement {
  return (
    <li className="flex flex-col gap-1 text-xs border-l-2 border-gray-700 pl-3 py-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-gray-500 tabular-nums">{formatTimestamp(entry.changedAt)}</span>
        <VerifiableLedgerLink
          claimType={entry.changedBy.startsWith('C') ? 'contract' : 'account'}
          identifier={entry.changedBy}
          label={truncateAddress(entry.changedBy)}
          fallbackText={truncateAddress(entry.changedBy)}
          title={`Verify account ${entry.changedBy} on Stellar`}
          className="font-mono text-gray-400 hover:text-cyan-300"
        />
      </div>
      <div className="flex items-center gap-2 text-gray-300">
        <span className="line-through text-gray-500">{formatParameterValue(entry.previousValue)}</span>
        <span aria-hidden="true">→</span>
        <span className="font-semibold">{formatParameterValue(entry.newValue)}</span>
      </div>
      {entry.reason && <p className="text-gray-400 italic">{entry.reason}</p>}
    </li>
  )
})

interface ParameterRowProps {
  record: ParameterRecord
  now: number
  isWatched: boolean
  onToggleWatch: (record: ParameterRecord) => void
}

const ParameterRow = memo(function ParameterRow({
  record,
  now,
  isWatched,
  onToggleWatch,
}: ParameterRowProps): ReactElement {
  const [historyOpen, setHistoryOpen] = useState(false)
  const recent = changedRecently(record, RECENT_WINDOW_MS, now)
  const latest = latestChange(record)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-100 text-sm">{record.label}</span>
            {recent && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Updated recently
              </span>
            )}
            {isWatched && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-cyan-950 text-cyan-400 border border-cyan-800">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Watching
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-gray-500">{record.key}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-200 bg-gray-800 px-2 py-1 rounded">
            {formatParameterValue(record.currentValue)}
          </span>
          <button
            type="button"
            onClick={() => onToggleWatch(record)}
            aria-label={isWatched ? `Unwatch ${record.label}` : `Watch ${record.label}`}
            aria-pressed={isWatched}
            title={
              isWatched
                ? 'Stop receiving notifications for this parameter'
                : 'Notify me when this parameter changes'
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
              isWatched
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${isWatched ? 'fill-current' : 'fill-none stroke-current'}`}
              viewBox="0 0 24 24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>{isWatched ? 'Watching' : 'Watch'}</span>
          </button>
        </div>
      </div>

      {/* Owner + last change */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
        <div>
          <dt className="text-gray-500">Owner</dt>
          <dd className="font-mono text-gray-300">
            <VerifiableLedgerLink
              claimType={record.owner.startsWith('C') ? 'contract' : 'account'}
              identifier={record.owner}
              label={truncateAddress(record.owner)}
              fallbackText={truncateAddress(record.owner)}
              title={`Verify owner ${record.owner} on Stellar`}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            />
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Last changed</dt>
          <dd className="text-gray-300">
            {record.lastChangedAt !== null ? formatTimestamp(record.lastChangedAt) : 'Never changed'}
          </dd>
        </div>
        {latest && (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Last reason</dt>
            <dd className="text-gray-300 italic">{latest.reason || 'No reason recorded'}</dd>
          </div>
        )}
      </dl>

      {/* Change history toggle */}
      {record.history.length > 0 && (
        <div>
          <button
            type="button"
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline-offset-2 hover:underline"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            {historyOpen
              ? 'Hide change history'
              : `Show change history (${record.history.length} change${record.history.length === 1 ? '' : 's'})`}
          </button>
          {historyOpen && (
            <ol
              aria-label={`Change history for ${record.label}`}
              className="mt-2 flex flex-col gap-2 list-none p-0"
            >
              {record.history.map((entry) => (
                <ChangeEntryRow key={entry.version} entry={entry} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
})

export interface ParameterRegistryPanelProps {
  records: readonly ParameterRecord[]
  /** Injected clock for deterministic rendering in tests. */
  now?: number
  /** Initial filter tab (defaults to 'all'). */
  initialFilter?: 'all' | 'watched'
}

export const ParameterRegistryPanel = memo(function ParameterRegistryPanel({
  records,
  now = Date.now(),
  initialFilter = 'all',
}: ParameterRegistryPanelProps): ReactElement {
  const [query, setQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'watched'>(initialFilter)

  const {
    isWatched,
    toggleWatch,
    unacknowledgedChanges,
    dismissChange,
    dismissAllChanges,
    watchedCount,
  } = useWatchedParameters(records)

  const visibleRecords = filterTab === 'watched' ? records.filter((r) => isWatched(r.key)) : records
  const filtered = searchParameters(visibleRecords, query)
  const grouped = groupByCategory(filtered)

  return (
    <section aria-labelledby="param-registry-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="param-registry-heading" className="text-lg font-semibold text-gray-100">
          Parameter registry
        </h2>
        <p className="text-xs text-gray-400">
          All registered system parameters — who owns each one, its current value, and every change that has been made.
        </p>
      </div>

      {/* Watched parameters change notification banner (#852) */}
      {unacknowledgedChanges.length > 0 && (
        <aside
          role="status"
          aria-label="Watched parameter updates"
          className="bg-cyan-950/40 border border-cyan-800/80 rounded-xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {unacknowledgedChanges.length} watched parameter
              {unacknowledgedChanges.length > 1 ? 's have' : ' has'} changed
            </span>
            <button
              type="button"
              onClick={dismissAllChanges}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              Dismiss all
            </button>
          </div>
          <ul className="flex flex-col gap-2 list-none p-0 text-xs">
            {unacknowledgedChanges.map((change) => (
              <li
                key={change.key}
                className="flex items-center justify-between gap-2 bg-gray-900/80 p-2.5 rounded-lg border border-cyan-900/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-gray-200">{change.label}</span>
                  <div className="flex items-center gap-2 text-gray-400 flex-wrap">
                    <span className="line-through text-gray-500">
                      {formatParameterValue(change.previousValue)}
                    </span>
                    <span aria-hidden="true">→</span>
                    <span className="text-cyan-300 font-mono font-medium">
                      {formatParameterValue(change.newValue)}
                    </span>
                    {change.changedAt && (
                      <span className="text-gray-500">at {formatTimestamp(change.changedAt)}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissChange(change.key)}
                  className="text-gray-400 hover:text-gray-200 text-xs px-2 py-1"
                  aria-label={`Dismiss update for ${change.label}`}
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Filter tabs and search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2" role="tablist" aria-label="Parameter view filters">
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'all'}
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterTab === 'all'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            All parameters ({records.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'watched'}
            onClick={() => setFilterTab('watched')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filterTab === 'watched'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Watched ({watchedCount})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <label htmlFor="param-search" className="sr-only">
            Search parameters
          </label>
          <input
            id="param-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by key or label…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
          />
        </div>
      </div>

      {grouped.size === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          {filterTab === 'watched' && watchedCount === 0
            ? 'You are not watching any parameters yet. Click the "Watch" button on any parameter to receive alerts when it is updated.'
            : records.length === 0
              ? 'No parameters have been registered yet.'
              : 'No parameters match your search.'}
        </p>
      )}

      {[...grouped.entries()].map(([category, categoryRecords]) => (
        <div key={category} className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-400 capitalize">{category}</h3>
          <ul className="flex flex-col gap-3 list-none p-0">
            {categoryRecords.map((record) => (
              <li key={record.key}>
                <ParameterRow
                  record={record}
                  now={now}
                  isWatched={isWatched(record.key)}
                  onToggleWatch={toggleWatch}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
})
