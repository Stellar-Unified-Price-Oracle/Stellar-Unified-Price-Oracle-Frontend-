import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DataQualityReportModal } from './DataQualityReportModal'
import * as moderation from '../utils/moderation'

import { remove, STORAGE_KEYS } from '../utils/storage'

afterEach(cleanup)

describe('DataQualityReportModal', () => {
  beforeEach(() => {
    remove(STORAGE_KEYS.moderationReports)
    vi.restoreAllMocks()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DataQualityReportModal isOpen={false} onClose={vi.fn()} pair="XLM/USD" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders with pre-populated chart context when open', () => {
    const ts = 1773000000000
    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={vi.fn()}
        pair="XLM/USD"
        selectedTimestamp={ts}
        selectedPrice={0.425}
        availableSources={['binance', 'coinbase']}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /report data-quality concern/i })).toBeInTheDocument()
    expect(screen.getAllByText('XLM/USD').length).toBeGreaterThan(0)
    expect(screen.getByText('$0.425')).toBeInTheDocument()
    expect(screen.getByLabelText(/suspect oracle source/i)).toBeInTheDocument()
  })

  it('handles feed-level observation when timestamp and price are not provided', () => {
    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={vi.fn()}
        pair="BTC/USD"
      />,
    )

    expect(screen.getByText(/whole chart \/ general feed/i)).toBeInTheDocument()
  })

  it('submits a structured data-quality report and saves it to moderation store', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const ts = 1773000000000

    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={onClose}
        pair="XLM/USD"
        selectedTimestamp={ts}
        selectedPrice={0.42}
        availableSources={['binance', 'coinbase']}
        onSuccess={onSuccess}
      />,
    )

    const textarea = screen.getByPlaceholderText(/describe what you observed/i)
    fireEvent.change(textarea, {
      target: { value: 'Observed a 15% flash crash spike on Binance feed not present on Coinbase.' },
    })

    const submitBtn = screen.getByRole('button', { name: /submit concern/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/your data-quality concern has been submitted for review/i)).toBeInTheDocument()
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    const reports = moderation.loadReports()
    expect(reports.length).toBe(1)
    expect(reports[0].surface).toBe('chart')
    expect(reports[0].targetId).toBe('XLM/USD')
    expect(reports[0].category).toBe('data-quality')
    expect(reports[0].evidence).toContain('Observed a 15% flash crash spike')
    expect(reports[0].evidence).toContain('Observed point:')
  })

  it('closes on Escape key press and invokes onClose', () => {
    const onClose = vi.fn()
    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={onClose}
        pair="ETH/USD"
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking the close button', () => {
    const onClose = vi.fn()
    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={onClose}
        pair="ETH/USD"
      />,
    )

    const closeBtn = screen.getByRole('button', { name: /close dialog/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('surfaces error message when storage write fails', async () => {
    vi.spyOn(moderation, 'saveReports').mockReturnValue(false)

    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={vi.fn()}
        pair="XLM/USD"
      />,
    )

    const textarea = screen.getByPlaceholderText(/describe what you observed/i)
    fireEvent.change(textarea, { target: { value: 'Corrupted timestamp sequence.' } })

    fireEvent.click(screen.getByRole('button', { name: /submit concern/i }))

    await waitFor(() => {
      expect(screen.getByText(/unable to save your report to local storage/i)).toBeInTheDocument()
    })
  })

  it('displays duplicate report alert when similar report exists for this asset pair', () => {
    const existing = moderation.createReport({
      surface: 'chart',
      targetId: 'XLM/USD',
      category: 'data-quality',
      evidence: '[Concern: Abnormal price spike or sudden drop] Observed a 15% flash crash spike on Binance feed.',
      confidential: false,
    })
    moderation.saveReports([existing])

    render(
      <DataQualityReportModal
        isOpen={true}
        onClose={vi.fn()}
        pair="XLM/USD"
      />,
    )

    const textarea = screen.getByPlaceholderText(/describe what you observed/i)
    fireEvent.change(textarea, {
      target: { value: 'Observed a flash crash spike on Binance feed.' },
    })

    expect(screen.getByRole('region', { name: /likely duplicate reports warning/i })).toBeInTheDocument()
    expect(screen.getByText(/likely duplicate report detected/i)).toBeInTheDocument()
  })
})
