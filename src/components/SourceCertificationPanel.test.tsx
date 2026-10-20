import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SourceCertification } from '../types/governance'
import { SourceCertificationPanel } from './SourceCertificationPanel'

afterEach(cleanup)

const NOW = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

function makeCert(overrides: Partial<SourceCertification> = {}): SourceCertification {
  return {
    id: 'cert-1',
    source: 'chainlink',
    name: 'SOC-2 Type II Attestation',
    category: 'security',
    issuer: 'Trail of Bits',
    status: 'active',
    issuedAt: NOW - 60 * DAY,
    expiresAt: NOW + 120 * DAY,
    evidence: [
      {
        title: 'Trail of Bits SOC-2 Audit Report',
        url: 'https://example.com/reports/soc2.pdf',
        sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        type: 'audit_report',
      },
    ],
    description: 'Annual independent security verification of feed node operations.',
    ...overrides,
  }
}

const writeTextMock = vi.fn().mockResolvedValue(undefined)

describe('SourceCertificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })
  })

  it('renders section heading and empty state when no certifications exist', () => {
    render(<SourceCertificationPanel certifications={[]} now={NOW} />)
    expect(screen.getByRole('heading', { name: 'Source certifications' })).toBeInTheDocument()
    expect(screen.getByText(/No source certifications have been recorded/)).toBeInTheDocument()
  })

  it('renders certification details, status, issuer, and expiry status', () => {
    const cert = makeCert()
    render(<SourceCertificationPanel certifications={[cert]} now={NOW} />)

    expect(screen.getByText('SOC-2 Type II Attestation')).toBeInTheDocument()
    expect(screen.getByText('chainlink')).toBeInTheDocument()
    expect(screen.getByText('security', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Active', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Trail of Bits')).toBeInTheDocument()
    expect(screen.getByText(/Valid until/)).toBeInTheDocument()
    expect(screen.getByText(/Annual independent security verification/)).toBeInTheDocument()
  })

  it('renders expiring soon badge and urgency styling for near-term expiries', () => {
    const cert = makeCert({ expiresAt: NOW + 10 * DAY })
    render(<SourceCertificationPanel certifications={[cert]} now={NOW} />)

    expect(screen.getByText('Expiring Soon', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/Expires in 10d/)).toBeInTheDocument()
    expect(screen.getByText('1 expiring soon')).toBeInTheDocument()
  })

  it('renders expired badge when expiry has passed', () => {
    const cert = makeCert({ expiresAt: NOW - 3 * DAY })
    render(<SourceCertificationPanel certifications={[cert]} now={NOW} />)

    expect(screen.getByText('Expired', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/Expired 3d ago/)).toBeInTheDocument()
  })

  it('renders perpetual status for certifications without an expiry date', () => {
    const cert = makeCert({ expiresAt: null })
    render(<SourceCertificationPanel certifications={[cert]} now={NOW} />)

    expect(screen.getByText('Perpetual (No Expiry)')).toBeInTheDocument()
  })

  it('renders revocation alert with reason when certificate is revoked', () => {
    const cert = makeCert({
      status: 'revoked',
      revokedAt: NOW - 1 * DAY,
      revocationReason: 'Infrastructure key migration failed',
    })
    render(<SourceCertificationPanel certifications={[cert]} now={NOW} />)

    expect(screen.getByText('Revoked', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Infrastructure key migration failed/)
  })

  it('expands and collapses evidence documents with accessible links and copy hash', async () => {
    const cert = makeCert()
    render(<SourceCertificationPanel certifications={[cert]} now={NOW} />)

    const toggle = screen.getByRole('button', { name: /View verification evidence/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const reportLink = screen.getByRole('link', { name: /Trail of Bits SOC-2 Audit Report/ })
    expect(reportLink).toHaveAttribute('href', 'https://example.com/reports/soc2.pdf')
    expect(reportLink).toHaveAttribute('target', '_blank')
    expect(reportLink).toHaveAttribute('rel', 'noopener noreferrer')

    const copyBtn = screen.getByRole('button', { name: /Copy SHA-256 digest/ })
    fireEvent.click(copyBtn)
    expect(writeTextMock).toHaveBeenCalledWith(cert.evidence[0].sha256)
  })

  it('filters certifications by search query across multiple fields', async () => {
    const user = userEvent.setup()
    const certs = [
      makeCert({ id: 'c1', name: 'SOC-2 Report', source: 'chainlink' }),
      makeCert({ id: 'c2', name: 'ISO-27001 Certification', source: 'reflector' }),
    ]
    render(<SourceCertificationPanel certifications={certs} now={NOW} />)

    const searchInput = screen.getByRole('searchbox')
    await user.type(searchInput, 'reflector')

    expect(screen.queryByText('SOC-2 Report')).not.toBeInTheDocument()
    expect(screen.getByText('ISO-27001 Certification')).toBeInTheDocument()
  })

  it('filters certifications by status dropdown', async () => {
    const user = userEvent.setup()
    const certs = [
      makeCert({ id: 'c1', name: 'Active Cert', expiresAt: NOW + 90 * DAY }),
      makeCert({ id: 'c2', name: 'Expiring Cert', expiresAt: NOW + 10 * DAY }),
      makeCert({ id: 'c3', name: 'Expired Cert', expiresAt: NOW - 5 * DAY }),
    ]
    render(<SourceCertificationPanel certifications={certs} now={NOW} />)

    const statusSelect = screen.getByRole('combobox', { name: /Filter by status/ })
    await user.selectOptions(statusSelect, 'expiring-soon')

    expect(screen.queryByText('Active Cert')).not.toBeInTheDocument()
    expect(screen.getByText('Expiring Cert')).toBeInTheDocument()
    expect(screen.queryByText('Expired Cert')).not.toBeInTheDocument()
  })

  it('filters certifications by category dropdown', async () => {
    const user = userEvent.setup()
    const certs = [
      makeCert({ id: 'c1', name: 'Security Audit', category: 'security' }),
      makeCert({ id: 'c2', name: 'Compliance License', category: 'compliance' }),
    ]
    render(<SourceCertificationPanel certifications={certs} now={NOW} />)

    const categorySelect = screen.getByRole('combobox', { name: /Filter by category/ })
    await user.selectOptions(categorySelect, 'compliance')

    expect(screen.queryByText('Security Audit')).not.toBeInTheDocument()
    expect(screen.getByText('Compliance License')).toBeInTheDocument()
  })
})
