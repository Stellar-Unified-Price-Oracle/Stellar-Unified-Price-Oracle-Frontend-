import { describe, it, expect } from 'vitest'
import type { SourceCertification } from '../types/governance'
import {
  deriveCertificationStatus,
  getCertificationExpiryInfo,
  getCertificationStatusBadge,
  filterCertifications,
  groupCertificationsBySource,
  truncateHash,
  formatCertDate,
} from './sourceCertification'

const NOW = 1_700_000_000_000 // Fixed reference time
const ONE_DAY = 24 * 60 * 60 * 1000

function makeCert(overrides: Partial<SourceCertification> = {}): SourceCertification {
  return {
    id: 'cert-1',
    source: 'chainlink',
    name: 'SOC-2 Type II',
    category: 'security',
    issuer: 'Trail of Bits',
    status: 'active',
    issuedAt: NOW - 100 * ONE_DAY,
    expiresAt: NOW + 180 * ONE_DAY,
    evidence: [
      {
        title: 'Audit Report PDF',
        url: 'https://example.com/reports/soc2.pdf',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        type: 'audit_report',
      },
    ],
    description: 'Annual independent security assessment',
    ...overrides,
  }
}

describe('sourceCertification utils', () => {
  describe('deriveCertificationStatus', () => {
    it('returns "active" for valid certificate expiring in the future', () => {
      const cert = makeCert({ expiresAt: NOW + 60 * ONE_DAY })
      expect(deriveCertificationStatus(cert, NOW)).toBe('active')
    })

    it('returns "expiring-soon" when expiry is within 30 days', () => {
      const cert = makeCert({ expiresAt: NOW + 15 * ONE_DAY })
      expect(deriveCertificationStatus(cert, NOW)).toBe('expiring-soon')
    })

    it('returns "expired" when expiry timestamp has passed', () => {
      const cert = makeCert({ expiresAt: NOW - 1 * ONE_DAY })
      expect(deriveCertificationStatus(cert, NOW)).toBe('expired')
    })

    it('returns "revoked" when revokedAt is present regardless of expiry', () => {
      const cert = makeCert({
        expiresAt: NOW + 90 * ONE_DAY,
        revokedAt: NOW - 2 * ONE_DAY,
        revocationReason: 'Key compromise',
      })
      expect(deriveCertificationStatus(cert, NOW)).toBe('revoked')
    })

    it('returns "suspended" when status is explicitly suspended', () => {
      const cert = makeCert({ status: 'suspended' })
      expect(deriveCertificationStatus(cert, NOW)).toBe('suspended')
    })
  })

  describe('getCertificationExpiryInfo', () => {
    it('handles perpetual certificates with null expiresAt', () => {
      const info = getCertificationExpiryInfo(null, NOW)
      expect(info.urgency).toBe('perpetual')
      expect(info.daysRemaining).toBeNull()
      expect(info.label).toMatch(/Perpetual/)
    })

    it('handles active certificates with remaining days', () => {
      const info = getCertificationExpiryInfo(NOW + 45 * ONE_DAY, NOW)
      expect(info.urgency).toBe('active')
      expect(info.daysRemaining).toBe(45)
      expect(info.label).toContain('45d remaining')
    })

    it('handles expiring-soon certificates within window', () => {
      const info = getCertificationExpiryInfo(NOW + 10 * ONE_DAY, NOW)
      expect(info.urgency).toBe('expiring-soon')
      expect(info.daysRemaining).toBe(10)
      expect(info.label).toContain('Expires in 10d')
    })

    it('handles expired certificates', () => {
      const info = getCertificationExpiryInfo(NOW - 5 * ONE_DAY, NOW)
      expect(info.urgency).toBe('expired')
      expect(info.label).toContain('Expired 5d ago')
    })
  })

  describe('getCertificationStatusBadge', () => {
    it('returns badge metadata for all valid statuses', () => {
      expect(getCertificationStatusBadge('active').label).toBe('Active')
      expect(getCertificationStatusBadge('expiring-soon').label).toBe('Expiring Soon')
      expect(getCertificationStatusBadge('expired').label).toBe('Expired')
      expect(getCertificationStatusBadge('revoked').label).toBe('Revoked')
      expect(getCertificationStatusBadge('suspended').label).toBe('Suspended')
    })
  })

  describe('filterCertifications', () => {
    const list = [
      makeCert({ id: 'c1', source: 'chainlink', name: 'SOC-2', category: 'security', expiresAt: NOW + 100 * ONE_DAY }),
      makeCert({ id: 'c2', source: 'reflector', name: 'ISO-27001', category: 'compliance', expiresAt: NOW + 5 * ONE_DAY }),
      makeCert({ id: 'c3', source: 'binance', name: 'API Attestation', category: 'infrastructure', expiresAt: NOW - 10 * ONE_DAY }),
      makeCert({ id: 'c4', source: 'kraken', name: 'Key Security', category: 'security', revokedAt: NOW - 1 }),
    ]

    it('returns all items when filters are empty', () => {
      expect(filterCertifications(list, '', 'all', 'all', NOW)).toHaveLength(4)
    })

    it('filters by search query matching source or name', () => {
      const bySource = filterCertifications(list, 'reflector', 'all', 'all', NOW)
      expect(bySource).toHaveLength(1)
      expect(bySource[0].id).toBe('c2')

      const byName = filterCertifications(list, 'ISO', 'all', 'all', NOW)
      expect(byName).toHaveLength(1)
      expect(byName[0].id).toBe('c2')
    })

    it('filters by derived status', () => {
      const expiringSoon = filterCertifications(list, '', 'expiring-soon', 'all', NOW)
      expect(expiringSoon).toHaveLength(1)
      expect(expiringSoon[0].id).toBe('c2')

      const expired = filterCertifications(list, '', 'expired', 'all', NOW)
      expect(expired).toHaveLength(1)
      expect(expired[0].id).toBe('c3')

      const revoked = filterCertifications(list, '', 'revoked', 'all', NOW)
      expect(revoked).toHaveLength(1)
      expect(revoked[0].id).toBe('c4')
    })

    it('filters by category', () => {
      const security = filterCertifications(list, '', 'all', 'security', NOW)
      expect(security).toHaveLength(2)
    })
  })

  describe('groupCertificationsBySource', () => {
    it('groups multiple certificates under matching source names', () => {
      const list = [
        makeCert({ id: 'c1', source: 'chainlink' }),
        makeCert({ id: 'c2', source: 'chainlink' }),
        makeCert({ id: 'c3', source: 'reflector' }),
      ]
      const grouped = groupCertificationsBySource(list)
      expect(grouped.size).toBe(2)
      expect(grouped.get('chainlink')).toHaveLength(2)
      expect(grouped.get('reflector')).toHaveLength(1)
    })
  })

  describe('truncateHash and formatCertDate', () => {
    it('truncates long hashes with ellipsis', () => {
      const full = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      const truncated = truncateHash(full)
      expect(truncated).toBe('e3b0c442…52b855')
    })

    it('formats timestamps into date strings', () => {
      const str = formatCertDate(1700000000000)
      expect(str).toContain('2023')
    })
  })
})
