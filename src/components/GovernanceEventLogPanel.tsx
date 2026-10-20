/**
 * @file GovernanceEventLogPanel (#858).
 *
 * Filterable governance audit trail exposing stable event identifiers
 * with CSV and JSON export capability.
 */

import { memo, useMemo, useState, type ReactElement } from 'react'
import type { GovernanceEvent, GovernanceEventFilters, GovernanceEventType } from '../types/governanceEvents'
import type { OracleNetwork } from '../lib/contractRegistry'
import {
  EVENT_TYPE_BADGES,
  EVENT_TYPE_LABELS,
  filterGovernanceEvents,
  governanceEventsToCsv,
  governanceEventsToJson,
  triggerFileDownload,
} from '../utils/governanceEvents'
import { GovernanceRoleBadge } from './GovernanceActionGate'

export interface GovernanceEventLogPanelProps {
  events: readonly GovernanceEvent[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  now?: number
}

function truncateMiddle(str: string, head = 6, tail = 6): string {
  if (str.length <= head + tail + 2) return str
  return `${str.slice(0, head)}…${str.slice(-tail)}`
}

export const GovernanceEventLogPanel = memo(function GovernanceEventLogPanel({
  events,
  loading = false,
  error = null,
  onRetry,
  now = Date.now(),
}: GovernanceEventLogPanelProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState<GovernanceEventType | 'all'>('all')
  const [networkFilter, setNetworkFilter] = useState<OracleNetwork | 'all'>('all')
  const [timeWindowFilter, setTimeWindowFilter] = useState<'24h' | '7d' | '30d' | 'all'>('all')
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const filters = useMemo<GovernanceEventFilters>(
    () => ({
      searchQuery,
      eventType: eventTypeFilter,
      network: networkFilter,
      timeWindow: timeWindowFilter,
    }),
    [searchQuery, eventTypeFilter, networkFilter, timeWindowFilter],
  )

  const filteredEvents = useMemo(
    () => filterGovernanceEvents(events, filters, now),
    [events, filters, now],
  )

  const handleExportCsv = () => {
    const csvData = governanceEventsToCsv(filteredEvents)
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-')
    triggerFileDownload(csvData, `governance-events-${timestampStr}.csv`, 'text/csv;charset=utf-8;')
    setExportNotice(`Exported ${filteredEvents.length} events as CSV`)
    setTimeout(() => setExportNotice(null), 4000)
  }

  const handleExportJson = () => {
    const jsonData = governanceEventsToJson(filteredEvents)
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-')
    triggerFileDownload(jsonData, `governance-events-${timestampStr}.json`, 'application/json;charset=utf-8;')
    setExportNotice(`Exported ${filteredEvents.length} events as JSON`)
    setTimeout(() => setExportNotice(null), 4000)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setEventTypeFilter('all')
    setNetworkFilter('all')
    setTimeWindowFilter('all')
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    eventTypeFilter !== 'all' ||
    networkFilter !== 'all' ||
    timeWindowFilter !== 'all'

  return (
    <section
      aria-labelledby="governance-events-heading"
      className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="governance-events-heading" className="text-lg font-semibold text-gray-100">
              Governance Event Log & Audit Trail
            </h2>
            <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-medium">
              Stable Identifiers
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Complete, deterministic audit trail of governance actions with immutable identifiers, verifiable on-chain
            hashes, and instant export.
          </p>
        </div>

        {/* ── Export Controls & Action Counters ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs bg-gray-800/80 border border-gray-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2 text-gray-300">
            <span>Showing:</span>
            <span className="font-semibold text-white">
              {filteredEvents.length} / {events.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredEvents.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Export filtered governance event log as CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={filteredEvents.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Export filtered governance event log as JSON"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      {/* ── Export Live Status Notification ─────────────────────────────── */}
      {exportNotice && (
        <div role="status" aria-live="polite" className="bg-green-500/10 border border-green-500/30 text-green-300 text-xs rounded-lg px-3 py-2">
          {exportNotice}
        </div>
      )}

      {/* ── Error State ─────────────────────────────────────────────────── */}
      {error !== null && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col items-start gap-2">
          <p className="text-sm text-red-300">
            Failed to load governance event log: {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Loading State ───────────────────────────────────────────────── */}
      {loading && events.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center" role="status">
          Loading governance event audit trail…
        </p>
      )}

      {/* ── Filter Controls ─────────────────────────────────────────────── */}
      {!loading && error === null && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div>
              <label htmlFor="gev-search" className="sr-only">
                Search events
              </label>
              <input
                id="gev-search"
                type="search"
                placeholder="Search event ID, actor, or target…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Event Type Filter */}
            <div>
              <label htmlFor="gev-type" className="sr-only">
                Filter by Event Type
              </label>
              <select
                id="gev-type"
                aria-label="Filter by Event Type"
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value as GovernanceEventType | 'all')}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Event Types</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Network Filter */}
            <div>
              <label htmlFor="gev-network" className="sr-only">
                Filter by Network
              </label>
              <select
                id="gev-network"
                aria-label="Filter by Network"
                value={networkFilter}
                onChange={(e) => setNetworkFilter(e.target.value as OracleNetwork | 'all')}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Networks</option>
                <option value="testnet">Stellar Testnet</option>
                <option value="mainnet">Stellar Mainnet</option>
                <option value="futurenet">Stellar Futurenet</option>
              </select>
            </div>

            {/* Time Window Filter */}
            <div>
              <label htmlFor="gev-timewindow" className="sr-only">
                Filter by Time Window
              </label>
              <select
                id="gev-timewindow"
                aria-label="Filter by Time Window"
                value={timeWindowFilter}
                onChange={(e) => setTimeWindowFilter(e.target.value as '24h' | '7d' | '30d' | 'all')}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Active Filter Clear Bar */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/40 border border-gray-800 rounded-lg px-3 py-1.5">
              <span>Filtering active criteria</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-cyan-400 hover:text-cyan-300 font-medium focus:outline-none"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* ── Events Data Table ────────────────────────────────────────── */}
          {filteredEvents.length === 0 ? (
            <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2">
              <p className="text-sm text-gray-400">
                {hasActiveFilters
                  ? 'No governance events match the current filter criteria.'
                  : 'No governance events have been recorded.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs" aria-label="Governance Event Log Table">
                <thead className="bg-gray-800/60 text-gray-400 font-medium border-b border-gray-800">
                  <tr>
                    <th scope="col" className="px-4 py-3">Stable Event ID</th>
                    <th scope="col" className="px-4 py-3">Event Type</th>
                    <th scope="col" className="px-4 py-3">Actor & Role</th>
                    <th scope="col" className="px-4 py-3">Target Entity</th>
                    <th scope="col" className="px-4 py-3">Description</th>
                    <th scope="col" className="px-4 py-3">Network</th>
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3 text-right">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/70">
                  {filteredEvents.map((ev) => {
                    const badge = EVENT_TYPE_BADGES[ev.eventType]
                    return (
                      <tr key={ev.id} className="hover:bg-gray-800/30 transition-colors">
                        {/* Event ID */}
                        <td className="px-4 py-3 font-mono text-[11px] text-cyan-300 whitespace-nowrap">
                          {ev.id}
                        </td>

                        {/* Event Type */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {EVENT_TYPE_LABELS[ev.eventType]}
                          </span>
                        </td>

                        {/* Actor & Role */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-gray-300" title={ev.actorAddress}>
                              {truncateMiddle(ev.actorAddress)}
                            </span>
                            <GovernanceRoleBadge role={ev.actorRole} className="w-fit" />
                          </div>
                        </td>

                        {/* Target Entity */}
                        <td className="px-4 py-3 font-mono text-gray-300 whitespace-nowrap">
                          {ev.targetEntityId}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 text-gray-300 max-w-xs">
                          {ev.description}
                        </td>

                        {/* Network */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[11px] font-mono text-gray-300 uppercase">
                            {ev.network}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {new Date(ev.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Proof / Tx Hash */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {ev.txHash ? (
                            <a
                              href={`https://stellar.expert/explorer/${ev.network}/tx/${ev.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] hover:underline"
                              title={`View transaction ${ev.txHash} on Stellar Expert`}
                            >
                              {truncateMiddle(ev.txHash, 4, 4)} ↗
                            </a>
                          ) : (
                            <span className="text-gray-600 font-mono text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
})
