/**
 * @file OperatorDisclosuresPanel (#856)
 *
 * Exposes operator conflict-of-interest disclosures with clear cryptographic
 * and on-chain provenance. Allows filtering by operator, category, materiality,
 * and affected pairs.
 */

import { memo, useMemo, useState, type ReactElement } from 'react'
import type { ConflictCategory, MaterialityLevel, OperatorDisclosure, ProvenanceStatus } from '../types/operatorDisclosures'
import {
  CONFLICT_CATEGORY_LABELS,
  MATERIALITY_LABELS,
  MATERIALITY_STYLES,
  PROVENANCE_STATUS_LABELS,
  PROVENANCE_STATUS_STYLES,
  filterDisclosures,
  summarizeDisclosures,
} from '../utils/operatorDisclosures'
import { VALID_PAIRS } from '../types'

export interface OperatorDisclosuresPanelProps {
  disclosures: readonly OperatorDisclosure[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  now?: number
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

export const OperatorDisclosuresPanel = memo(function OperatorDisclosuresPanel({
  disclosures,
  loading = false,
  error = null,
  onRetry,
}: OperatorDisclosuresPanelProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ConflictCategory | 'all'>('all')
  const [materialityFilter, setMaterialityFilter] = useState<MaterialityLevel | 'all'>('all')
  const [provenanceFilter, setProvenanceFilter] = useState<ProvenanceStatus | 'all'>('all')
  const [pairFilter, setPairFilter] = useState<string | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const summary = useMemo(() => summarizeDisclosures(disclosures), [disclosures])

  const filtered = useMemo(
    () =>
      filterDisclosures(disclosures, {
        searchQuery,
        category: categoryFilter,
        materiality: materialityFilter,
        provenanceStatus: provenanceFilter,
        assetPair: pairFilter,
      }),
    [disclosures, searchQuery, categoryFilter, materialityFilter, provenanceFilter, pairFilter],
  )

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    categoryFilter !== 'all' ||
    materialityFilter !== 'all' ||
    provenanceFilter !== 'all' ||
    pairFilter !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setMaterialityFilter('all')
    setProvenanceFilter('all')
    setPairFilter('all')
  }

  return (
    <section
      aria-labelledby="operator-disclosures-heading"
      className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="operator-disclosures-heading" className="text-lg font-semibold text-gray-100">
              Operator Conflict-of-Interest Disclosures
            </h2>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-medium">
              Provenance Verified
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Auditable disclosures of liquidity, validator, protocol, and token positions held by feed operators with
            verifiable attestation hashes.
          </p>
        </div>

        {/* ── Summary Badges ── */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="bg-gray-800/80 border border-gray-700/60 rounded-lg px-3 py-1.5 flex flex-col">
            <span className="text-gray-400">Total Disclosures</span>
            <span className="font-semibold text-gray-100">{summary.totalDisclosures}</span>
          </div>
          <div className="bg-gray-800/80 border border-gray-700/60 rounded-lg px-3 py-1.5 flex flex-col">
            <span className="text-gray-400">Verified On-Chain</span>
            <span className="font-semibold text-green-400">
              {summary.totalDisclosures > 0
                ? `${Math.round((summary.verifiedCount / summary.totalDisclosures) * 100)}%`
                : '100%'}
            </span>
          </div>
          <div className="bg-gray-800/80 border border-gray-700/60 rounded-lg px-3 py-1.5 flex flex-col">
            <span className="text-gray-400">High Materiality</span>
            <span className="font-semibold text-amber-400">{summary.highMaterialityCount}</span>
          </div>
        </div>
      </div>

      {/* ── Error State ─────────────────────────────────────────────────── */}
      {error !== null && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col items-start gap-2">
          <p className="text-sm text-red-300">
            Failed to load operator disclosures: {error}
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
      {loading && disclosures.length === 0 && (
        <p className="text-sm text-gray-500 py-6 text-center" role="status">
          Loading operator disclosures…
        </p>
      )}

      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      {!loading && error === null && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <label htmlFor="disclosure-search" className="sr-only">
                Search operators
              </label>
              <input
                id="disclosure-search"
                type="search"
                placeholder="Search operator or address…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label htmlFor="disclosure-category" className="sr-only">
                Filter by Category
              </label>
              <select
                id="disclosure-category"
                aria-label="Filter by Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ConflictCategory | 'all')}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CONFLICT_CATEGORY_LABELS).map(([cat, label]) => (
                  <option key={cat} value={cat}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Materiality Filter */}
            <div>
              <label htmlFor="disclosure-materiality" className="sr-only">
                Filter by Materiality
              </label>
              <select
                id="disclosure-materiality"
                aria-label="Filter by Materiality"
                value={materialityFilter}
                onChange={(e) => setMaterialityFilter(e.target.value as MaterialityLevel | 'all')}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Materiality</option>
                <option value="high">High Impact</option>
                <option value="medium">Medium Impact</option>
                <option value="low">Low Impact</option>
              </select>
            </div>

            {/* Provenance Status Filter */}
            <div>
              <label htmlFor="disclosure-provenance" className="sr-only">
                Filter by Provenance
              </label>
              <select
                id="disclosure-provenance"
                aria-label="Filter by Provenance"
                value={provenanceFilter}
                onChange={(e) => setProvenanceFilter(e.target.value as ProvenanceStatus | 'all')}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Provenance</option>
                <option value="verified">Attestation Verified</option>
                <option value="unverified">Pending Verification</option>
                <option value="expired">Attestation Expired</option>
                <option value="disputed">Provenance Disputed</option>
              </select>
            </div>

            {/* Affected Pair Filter */}
            <div>
              <label htmlFor="disclosure-pair" className="sr-only">
                Filter by Affected Pair
              </label>
              <select
                id="disclosure-pair"
                aria-label="Filter by Affected Pair"
                value={pairFilter}
                onChange={(e) => setPairFilter(e.target.value)}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">All Affected Pairs</option>
                {VALID_PAIRS.map((pair) => (
                  <option key={pair} value={pair}>
                    {pair}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                Showing {filtered.length} of {disclosures.length} disclosures matching criteria
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-cyan-400 hover:text-cyan-300 underline font-medium focus:outline-none"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Disclosures Content ─────────────────────────────────────────── */}
      {!loading && error === null && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2">
              <p className="text-sm text-gray-400">
                {hasActiveFilters
                  ? 'No operator disclosures match the selected filter criteria.'
                  : 'No operator disclosures are on record.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id
                const categoryLabel = CONFLICT_CATEGORY_LABELS[item.category] ?? item.category
                const materialityStyle = MATERIALITY_STYLES[item.materiality]
                const provenanceStyle = PROVENANCE_STATUS_STYLES[item.provenance.status]
                const provenanceLabel = PROVENANCE_STATUS_LABELS[item.provenance.status]

                return (
                  <article
                    key={item.id}
                    className="bg-gray-800/50 border border-gray-800 hover:border-gray-700 rounded-xl p-5 flex flex-col gap-4 transition-colors"
                  >
                    {/* Top Row: Operator Info and Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-100">{item.operatorName}</h3>
                          {item.organization && (
                            <span className="text-xs text-gray-400">({item.organization})</span>
                          )}
                          <span className="text-xs text-gray-500 font-mono">
                            {truncateAddress(item.stellarAddress)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 font-medium">{categoryLabel}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Materiality Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${materialityStyle.badge}`}
                        >
                          {MATERIALITY_LABELS[item.materiality]}
                        </span>

                        {/* Provenance Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${provenanceStyle}`}
                        >
                          {provenanceLabel}
                        </span>
                      </div>
                    </div>

                    {/* Conflict Description */}
                    <p className="text-xs text-gray-300 leading-relaxed">{item.description}</p>

                    {/* Middle Row: Affected Pairs & Financial Interest */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-gray-800/80 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Affected Pairs:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.affectedPairs.map((pair) => (
                            <span
                              key={pair}
                              className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-mono text-[11px]"
                            >
                              {pair}
                            </span>
                          ))}
                        </div>
                      </div>

                      {item.financialInterestEstimate && (
                        <div className="text-gray-400">
                          <span className="text-gray-500">Exposure:</span>{' '}
                          <span className="text-gray-200 font-medium">{item.financialInterestEstimate}</span>
                        </div>
                      )}
                    </div>

                    {/* Provenance Details Box */}
                    <div className="bg-gray-900/80 border border-gray-800/90 rounded-lg p-3 text-xs flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                          Cryptographic Provenance
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          aria-expanded={isExpanded}
                          className="text-cyan-400 hover:text-cyan-300 text-xs font-medium focus:outline-none"
                        >
                          {isExpanded ? 'Hide audit details' : 'View audit details'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-gray-400">
                        <div>
                          <span className="text-gray-500 block text-[11px]">Attestation Hash:</span>
                          <span className="font-mono text-gray-300" title={item.provenance.attestationHash}>
                            {truncateHash(item.provenance.attestationHash)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[11px]">Anchored Time:</span>
                          <span className="text-gray-300">
                            {new Date(item.provenance.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[11px]">Attestation Method:</span>
                          <span className="text-gray-300 capitalize">
                            {item.provenance.method.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Raw Audit Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 pt-2 mt-1 flex flex-col gap-2 text-[11px]">
                          <div>
                            <span className="text-gray-500 block">Full Attestation Hash:</span>
                            <span className="font-mono text-cyan-300 break-all select-all">
                              {item.provenance.attestationHash}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Signed By (Stellar Public Key):</span>
                            <span className="font-mono text-gray-300 break-all select-all">
                              {item.provenance.signedBy}
                            </span>
                          </div>
                          {item.provenance.provenanceUrl && (
                            <div>
                              <span className="text-gray-500 block">On-Chain Evidence / Verification URL:</span>
                              <a
                                href={item.provenance.provenanceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:underline break-all"
                              >
                                {item.provenance.provenanceUrl}
                              </a>
                            </div>
                          )}
                          <div className="flex gap-4 text-gray-500">
                            <span>Disclosed: {new Date(item.disclosedAt).toUTCString()}</span>
                            {item.lastVerifiedAt && (
                              <span>Last Verified: {new Date(item.lastVerifiedAt).toUTCString()}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
})
