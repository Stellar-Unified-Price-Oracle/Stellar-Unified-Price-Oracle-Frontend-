/**
 * @file SourceCertificationPanel (#855)
 *
 * Displays oracle source certifications, audit status, evidence links,
 * and expiry timelines.
 *
 * Features:
 * - Search by source, name, issuer, or category.
 * - Filters by derived operational status (active, expiring-soon, expired, revoked).
 * - Verified evidence links with SHA-256 digests.
 * - Visual expiry countdowns and urgency alerts.
 * - Accessible keyboard interaction and screen-reader context.
 */
import { memo, useState, useMemo, type ReactElement } from 'react'
import type { SourceCertification, CertificationEvidence } from '../types/governance'
import { SOURCE_COLORS } from '../utils/sourceColors'
import {
  deriveCertificationStatus,
  getCertificationExpiryInfo,
  getCertificationStatusBadge,
  filterCertifications,
  formatCertDate,
  truncateHash,
} from '../utils/sourceCertification'

interface EvidenceItemRowProps {
  evidence: CertificationEvidence
}

const EvidenceItemRow = memo(function EvidenceItemRow({ evidence }: EvidenceItemRowProps): ReactElement {
  const [copied, setCopied] = useState(false)

  const handleCopyHash = () => {
    if (!evidence.sha256) return
    navigator.clipboard.writeText(evidence.sha256).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {},
    )
  }

  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-gray-950/50 border border-gray-800 text-xs">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 inline-flex items-center gap-1"
          >
            <span>{evidence.title}</span>
            <svg
              className="w-3 h-3 text-cyan-400/80 shrink-0"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M6 3h7v7M13 3L6.5 9.5" />
            </svg>
            <span className="sr-only"> (opens verification evidence in new tab)</span>
          </a>
          {evidence.type && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
              {evidence.type.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        {evidence.sha256 && (
          <div className="flex items-center gap-2 text-gray-400 font-mono text-[11px] pt-0.5">
            <span className="text-gray-500">SHA-256:</span>
            <span title={evidence.sha256}>{truncateHash(evidence.sha256, 10, 8)}</span>
          </div>
        )}
      </div>

      {evidence.sha256 && (
        <button
          type="button"
          onClick={handleCopyHash}
          aria-label={`Copy SHA-256 digest for ${evidence.title}`}
          className="text-[11px] px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors shrink-0 self-start sm:self-auto"
        >
          {copied ? 'Copied digest' : 'Copy hash'}
        </button>
      )}
    </li>
  )
})

interface CertificationCardProps {
  cert: SourceCertification
  now: number
}

const CertificationCard = memo(function CertificationCard({ cert, now }: CertificationCardProps): ReactElement {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const status = deriveCertificationStatus(cert, now)
  const badge = getCertificationStatusBadge(status)
  const expiry = getCertificationExpiryInfo(cert.expiresAt, now)

  const isUrgent = expiry.urgency === 'expiring-soon' || expiry.urgency === 'expired' || status === 'revoked'

  return (
    <article
      aria-labelledby={`cert-title-${cert.id}`}
      className={[
        'bg-gray-900 border rounded-2xl p-5 flex flex-col gap-4 transition-colors',
        isUrgent ? 'border-amber-500/30' : 'border-gray-800',
      ].join(' ')}
    >
      {/* Top Header: Source, Title, Badges */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${SOURCE_COLORS[cert.source] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}
            >
              {cert.source}
            </span>
            <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              {cert.category}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.badgeClass}`}
            >
              {badge.label}
            </span>
          </div>
          <h3 id={`cert-title-${cert.id}`} className="text-base font-semibold text-gray-100">
            {cert.name}
          </h3>
          <p className="text-xs text-gray-400">
            Issued by <span className="text-gray-300 font-medium">{cert.issuer}</span>
          </p>
        </div>

        {/* Expiry Pill */}
        <div
          className={[
            'flex flex-col items-end px-3 py-1.5 rounded-lg border text-xs text-right',
            expiry.urgency === 'expired'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : expiry.urgency === 'expiring-soon'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-medium'
                : 'bg-gray-800/60 border-gray-700 text-gray-300',
          ].join(' ')}
        >
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Expiry Status</span>
          <span className="font-mono">{expiry.label}</span>
        </div>
      </div>

      {/* Revocation notice if applicable */}
      {status === 'revoked' && (
        <div
          role="alert"
          className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex flex-col gap-1"
        >
          <span className="font-semibold uppercase tracking-wider text-[11px] text-red-400">
            Certification Revoked
          </span>
          <p>
            {cert.revokedAt ? `Revoked on ${formatCertDate(cert.revokedAt)}. ` : ''}
            {cert.revocationReason || 'This certification was formally revoked by the issuing authority.'}
          </p>
        </div>
      )}

      {/* Description / Summary */}
      {cert.description && <p className="text-xs text-gray-300 leading-relaxed">{cert.description}</p>}

      {/* Timestamps */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t border-gray-800/80 pt-3 text-gray-400">
        <div>
          <dt className="text-gray-500">Issued</dt>
          <dd className="text-gray-200 font-mono mt-0.5">{formatCertDate(cert.issuedAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Valid Until</dt>
          <dd className="text-gray-200 font-mono mt-0.5">
            {cert.expiresAt !== null ? formatCertDate(cert.expiresAt) : 'Perpetual'}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-gray-500">Verified Evidence</dt>
          <dd className="text-gray-200 mt-0.5">
            {cert.evidence.length} artifact{cert.evidence.length === 1 ? '' : 's'}
          </dd>
        </div>
      </dl>

      {/* Evidence Toggle & List */}
      {cert.evidence.length > 0 && (
        <div className="border-t border-gray-800/80 pt-3">
          <button
            type="button"
            aria-expanded={evidenceOpen}
            aria-controls={`evidence-list-${cert.id}`}
            onClick={() => setEvidenceOpen((open) => !open)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded"
          >
            <span>
              {evidenceOpen
                ? 'Hide verification evidence'
                : `View verification evidence & audit artifacts (${cert.evidence.length})`}
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${evidenceOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {evidenceOpen && (
            <ul
              id={`evidence-list-${cert.id}`}
              aria-label={`Verification evidence for ${cert.name}`}
              className="mt-3 flex flex-col gap-2 list-none p-0"
            >
              {cert.evidence.map((ev, idx) => (
                <EvidenceItemRow key={`${ev.url}-${idx}`} evidence={ev} />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
})

export interface SourceCertificationPanelProps {
  certifications: readonly SourceCertification[]
  /** Injected clock for deterministic rendering in tests. */
  now?: number
}

export const SourceCertificationPanel = memo(function SourceCertificationPanel({
  certifications,
  now = Date.now(),
}: SourceCertificationPanelProps): ReactElement {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const c of certifications) set.add(c.category)
    return Array.from(set).sort()
  }, [certifications])

  const filtered = useMemo(
    () => filterCertifications(certifications, query, statusFilter, categoryFilter, now),
    [certifications, query, statusFilter, categoryFilter, now],
  )

  const activeCount = useMemo(
    () => certifications.filter((c) => deriveCertificationStatus(c, now) === 'active').length,
    [certifications, now],
  )
  const expiringCount = useMemo(
    () => certifications.filter((c) => deriveCertificationStatus(c, now) === 'expiring-soon').length,
    [certifications, now],
  )

  return (
    <section aria-labelledby="certifications-heading" className="flex flex-col gap-5">
      {/* Header and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 id="certifications-heading" className="text-lg font-semibold text-gray-100">
              Source certifications
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              {certifications.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 max-w-2xl">
            Verified technical attestations, security audits, and compliance certifications held by price oracle
            sources, with tamper-verifiable evidence and expiration tracking.
          </p>
        </div>

        {/* Quick summary counts */}
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {activeCount} active
          </span>
          {expiringCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
              {expiringCount} expiring soon
            </span>
          )}
        </div>
      </div>

      {/* Controls: Search, Status filter, Category filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="cert-search" className="sr-only">
            Search certifications
          </label>
          <input
            id="cert-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search source, title, issuer…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
          />
        </div>

        <div>
          <label htmlFor="cert-status-select" className="sr-only">
            Filter by status
          </label>
          <select
            id="cert-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="expiring-soon">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div>
          <label htmlFor="cert-category-select" className="sr-only">
            Filter by category
          </label>
          <select
            id="cert-category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 capitalize focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result Cards */}
      {filtered.length === 0 ? (
        <div className="p-8 border border-gray-800 bg-gray-900/60 rounded-2xl text-center">
          <p className="text-sm text-gray-400">
            {certifications.length === 0
              ? 'No source certifications have been recorded in the registry.'
              : 'No certifications match your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cert) => (
            <CertificationCard key={cert.id} cert={cert} now={now} />
          ))}
        </div>
      )}
    </section>
  )
})
