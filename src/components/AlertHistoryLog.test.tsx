import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { checkAccessibility } from '../test/accessibility'
import * as exportUtils from '../utils/export'
import { AlertHistoryLog } from './AlertHistoryLog'

vi.mock('../hooks/useAlerts', () => ({
  useAlerts: () => ({
    alertHistory: [
      {
        id: 'with-tick',
        alertId: 'alert-1',
        assetPair: 'BTC/USD',
        triggeredAt: 1_700_000_000_100,
        price: 61_000,
        triggerOnce: false,
        percentageMode: false,
        upperThreshold: 60_000,
        lowerThreshold: null,
        percentageThreshold: null,
        percentageWindow: null,
        percentageDirection: null,
        evidence: {
          timestamp: 1_700_000_000_000,
          confidence: 0.97,
          sources: ['chainlink'],
          sourcePrices: { chainlink: 61_010 },
        },
      },
      {
        id: 'without-source-prices',
        alertId: 'alert-2',
        assetPair: 'ETH/USD',
        triggeredAt: 1_700_000_000_100,
        price: 3_000,
        triggerOnce: false,
        percentageMode: false,
        upperThreshold: 2_900,
        lowerThreshold: null,
        percentageThreshold: null,
        percentageWindow: null,
        percentageDirection: null,
        evidence: {
          timestamp: 1_700_000_000_000,
          confidence: 0.9,
          sources: [],
        },
      },
    ],
    evaluationTimeline: [
      {
        id: 'evaluation-1',
        alertId: 'alert-1',
        assetPair: 'BTC/USD',
        evaluatedAt: 1_700_000_000_000,
        price: null,
        outcome: 'skipped',
        reason: 'price_unavailable',
      },
    ],
    clearAlertHistory: vi.fn(),
  }),
}))

describe('AlertHistoryLog tick evidence', () => {
  it('downloads filtered history from the CSV button', async () => {
    const download = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {})
    try {
      const user = userEvent.setup()
      render(<AlertHistoryLog />)
      await user.type(screen.getByRole('searchbox'), 'BTC')
      await user.click(screen.getByRole('button', { name: 'Export CSV' }))
      expect(await screen.findByText('Alert history export is ready.')).toBeInTheDocument()
      expect(download).toHaveBeenCalledWith(
        expect.stringContaining('BTC/USD'),
        expect.stringMatching(/\.csv$/),
        'text/csv',
      )
      expect(download.mock.calls[0][0]).not.toContain('ETH/USD')
    } finally {
      download.mockRestore()
    }
  })

  it('reveals tick facts on demand and labels feed fields that are unavailable', () => {
    render(<AlertHistoryLog />)

    const summaries = screen.getAllByText('Show exact tick evidence')
    fireEvent.click(summaries[0])

    expect(screen.getByText('chainlink: 61,010.00')).toBeInTheDocument()
    expect(screen.getByText('chainlink')).toBeInTheDocument()

    fireEvent.click(summaries[1])
    expect(screen.getAllByText('Not provided by the price feed')).toHaveLength(2)
  })

  it('shows a skipped evaluation reason when no price tick is available', () => {
    render(<AlertHistoryLog />)

    fireEvent.click(screen.getByText('Rule evaluation timeline (1)'))

    expect(screen.getByText('No current price tick was available', { exact: false })).toBeInTheDocument()
  })

  it('opens the timeline with the keyboard and has no accessibility violations', async () => {
    const user = userEvent.setup()
    render(<AlertHistoryLog />)

    const summary = screen.getByText('Rule evaluation timeline (1)')
    summary.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('No current price tick was available', { exact: false })).toBeInTheDocument()

    await checkAccessibility(<AlertHistoryLog />)
  })
})
