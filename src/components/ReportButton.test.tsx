import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReportButton } from './ReportButton'
import * as moderation from '../utils/moderation'
import { remove, STORAGE_KEYS } from '../utils/storage'

afterEach(cleanup)

describe('ReportButton with duplicate detection', () => {
  beforeEach(() => {
    remove(STORAGE_KEYS.moderationReports)
    vi.restoreAllMocks()
  })

  it('renders trigger button and opens dialog', () => {
    render(<ReportButton surface="governance" targetId="prop-12" label="Report Proposal" />)
    const btn = screen.getByRole('button', { name: 'Report Proposal' })
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Report content' })).toBeInTheDocument()
  })

  it('detects likely duplicate reports as user enters similar evidence', () => {
    // Seed an existing report
    const existing = moderation.createReport({
      surface: 'governance',
      targetId: 'prop-12',
      category: 'spam',
      evidence: 'Phishing domain link posted in proposal details pointing to fake wallet.',
      confidential: false,
    })
    moderation.saveReports([existing])

    render(<ReportButton surface="governance" targetId="prop-12" />)
    fireEvent.click(screen.getByRole('button', { name: 'Report' }))

    const textarea = screen.getByLabelText(/evidence \(links/i)
    fireEvent.change(textarea, {
      target: { value: 'There is a phishing domain link in this proposal pointing to a fake wallet.' },
    })

    // Warning alert region should appear
    expect(screen.getByRole('region', { name: /likely duplicate reports warning/i })).toBeInTheDocument()
    expect(screen.getByText(/likely duplicate report detected/i)).toBeInTheDocument()
    expect(screen.getByText(/prop-12/)).toBeInTheDocument()

    // Can dismiss the warning
    const dismissBtn = screen.getByRole('button', { name: /dismiss duplicate warning/i })
    fireEvent.click(dismissBtn)
    expect(screen.queryByRole('region', { name: /likely duplicate reports warning/i })).toBeNull()
  })

  it('submits successfully and clears evidence', () => {
    render(<ReportButton surface="feedback" targetId="general" />)
    fireEvent.click(screen.getByRole('button', { name: 'Report' }))

    const textarea = screen.getByLabelText(/evidence \(links/i)
    fireEvent.change(textarea, { target: { value: 'Inappropriate language in chat stream.' } })

    const submitBtn = screen.getByRole('button', { name: 'Submit report' })
    fireEvent.click(submitBtn)

    expect(screen.getByText(/your report is in the triage queue/i)).toBeInTheDocument()
    const reports = moderation.loadReports()
    expect(reports.length).toBe(1)
    expect(reports[0].targetId).toBe('general')
  })
})
