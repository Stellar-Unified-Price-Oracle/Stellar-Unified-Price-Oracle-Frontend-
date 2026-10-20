/**
 * @file sourceCertification.ts (#855)
 *
 * Domain utilities for oracle source certifications:
 * - Status derivation with automatic expiry detection and revocation priority.
 * - Expiry countdown, formatted timestamps, and urgency classification.
 * - Search, filtering, and grouping by source or category.
 * - Accessible status badges and design tokens.
 */
import type { CertificationStatus, SourceCertification } from '../types/governance'

export const EXPIRING_SOON_DAYS = 30
export const EXPIRING_SOON_MS = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000

export interface ExpiryInfo {
  label: string
  urgency: 'active' | 'expiring-soon' | 'expired' | 'perpetual'
  daysRemaining: number | null
  formattedDate: string
}

export interface StatusBadgeInfo {
  label: string
  badgeClass: string
  textClass: string
}

/** Formats unix timestamp (ms) to medium date string. */
export function formatCertDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Shortens a cryptographic hash or CID for compact UI display. */
export function truncateHash(hash: string, startChars = 8, endChars = 6): string {
  if (hash.length <= startChars + endChars + 2) return hash
  return `${hash.slice(0, startChars)}…${hash.slice(-endChars)}`
}

/**
 * Derives the operational status of a certification taking current time,
 * expiry date, and explicit revocation into account (#855).
 */
export function deriveCertificationStatus(
  cert: SourceCertification,
  now = Date.now(),
  expiringSoonMs = EXPIRING_SOON_MS,
): CertificationStatus {
  if (cert.revokedAt !== null && cert.revokedAt !== undefined) {
    return 'revoked'
  }
  if (cert.status === 'revoked') {
    return 'revoked'
  }
  if (cert.status === 'suspended') {
    return 'suspended'
  }

  if (cert.expiresAt !== null && cert.expiresAt !== undefined) {
    if (cert.expiresAt <= now) {
      return 'expired'
    }
    if (cert.expiresAt <= now + expiringSoonMs) {
      return 'expiring-soon'
    }
  }

  return 'active'
}

/**
 * Computes human-friendly expiry metadata and countdown metrics.
 */
export function getCertificationExpiryInfo(
  expiresAt: number | null,
  now = Date.now(),
  expiringSoonMs = EXPIRING_SOON_MS,
): ExpiryInfo {
  if (expiresAt === null || expiresAt === undefined) {
    return {
      label: 'Perpetual (No Expiry)',
      urgency: 'perpetual',
      daysRemaining: null,
      formattedDate: 'Continuous / Perpetual',
    }
  }

  const formattedDate = formatCertDate(expiresAt)
  const diffMs = expiresAt - now
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

  if (diffMs <= 0) {
    const expiredDaysAgo = Math.abs(days)
    return {
      label: expiredDaysAgo === 0 ? 'Expired today' : `Expired ${expiredDaysAgo}d ago (${formattedDate})`,
      urgency: 'expired',
      daysRemaining: days,
      formattedDate,
    }
  }

  if (diffMs <= expiringSoonMs) {
    return {
      label: `Expires in ${days}d (${formattedDate})`,
      urgency: 'expiring-soon',
      daysRemaining: days,
      formattedDate,
    }
  }

  return {
    label: `Valid until ${formattedDate} (${days}d remaining)`,
    urgency: 'active',
    daysRemaining: days,
    formattedDate,
  }
}

/**
 * Returns accessible visual styling tokens for a certification status badge.
 */
export function getCertificationStatusBadge(status: CertificationStatus): StatusBadgeInfo {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        textClass: 'text-emerald-400',
      }
    case 'expiring-soon':
      return {
        label: 'Expiring Soon',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        textClass: 'text-amber-400',
      }
    case 'expired':
      return {
        label: 'Expired',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        textClass: 'text-rose-400',
      }
    case 'revoked':
      return {
        label: 'Revoked',
        badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
        textClass: 'text-red-400',
      }
    case 'suspended':
      return {
        label: 'Suspended',
        badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        textClass: 'text-purple-400',
      }
  }
}

/**
 * Filters a collection of certifications based on search query, status, and category.
 */
export function filterCertifications(
  certifications: readonly SourceCertification[],
  query: string,
  statusFilter = 'all',
  categoryFilter = 'all',
  now = Date.now(),
): SourceCertification[] {
  const q = query.trim().toLowerCase()

  return certifications.filter((cert) => {
    const derivedStatus = deriveCertificationStatus(cert, now)

    // Status filter
    if (statusFilter !== 'all' && derivedStatus !== statusFilter) {
      return false
    }

    // Category filter
    if (categoryFilter !== 'all' && cert.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false
    }

    // Free text query
    if (q) {
      const matchSource = cert.source.toLowerCase().includes(q)
      const matchName = cert.name.toLowerCase().includes(q)
      const matchIssuer = cert.issuer.toLowerCase().includes(q)
      const matchCategory = cert.category.toLowerCase().includes(q)
      const matchDescription = cert.description ? cert.description.toLowerCase().includes(q) : false
      if (!matchSource && !matchName && !matchIssuer && !matchCategory && !matchDescription) {
        return false
      }
    }

    return true
  })
}

/**
 * Groups certifications by oracle source name.
 */
export function groupCertificationsBySource(
  certifications: readonly SourceCertification[],
): Map<string, SourceCertification[]> {
  const map = new Map<string, SourceCertification[]>()
  for (const cert of certifications) {
    const list = map.get(cert.source)
    if (list) {
      list.push(cert)
    } else {
      map.set(cert.source, [cert])
    }
  }
  return map
}
