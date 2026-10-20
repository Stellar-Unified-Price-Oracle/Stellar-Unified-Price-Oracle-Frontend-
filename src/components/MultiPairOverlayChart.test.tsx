import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PriceHistoryEntry } from '../types'
import { MultiPairOverlayChart } from './MultiPairOverlayChart'

afterEach(cleanup)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = Date.now()

function makeEntry(price: number, ts: number): PriceHistoryEntry {
  return { price, timestamp: ts, confidence: 0.95, sources: ['chainlink'] }
}

const btcHistory: PriceHistoryEntry[] = [
  makeEntry(50_000, NOW - 3_600_000),
  makeEntry(51_000, NOW - 1_800_000),
  makeEntry(52_000, NOW),
]

const ethHistory: PriceHistoryEntry[] = [
  makeEntry(3_000, NOW - 3_600_000),
  makeEntry(3_100, NOW - 1_800_000),
  makeEntry(3_200, NOW),
]

const sampleHistory: Record<string, PriceHistoryEntry[]> = {
  'BTC/USD': btcHistory,
  'ETH/USD': ethHistory,
}

function asLocalDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MultiPairOverlayChart', () => {
  it('renders without crashing with basic props', () => {
    expect(() => render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} />)).not.toThrow()
  })

  it('shows an empty state when pairs is empty', () => {
    render(<MultiPairOverlayChart pairs={[]} history={{}} />)
    expect(screen.getByText(/no pairs selected/i)).toBeInTheDocument()
  })

  it('shows an empty state when history is empty', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD']} history={{}} />)
    expect(screen.getByText(/no historical data available/i)).toBeInTheDocument()
  })

  it('reports unavailable aligned data when a benchmark has no history', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={{}} benchmarkPair="ETH/USD" />)
    expect(screen.getByText(/no aligned historical observations are available/i)).toBeInTheDocument()
  })

  it('renders legend entries for each pair', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} />)
    expect(screen.getAllByText('BTC/USD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ETH/USD').length).toBeGreaterThan(0)
  })

  it('labels the benchmark pair in the legend', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} benchmarkPair="ETH/USD" />)
    expect(screen.getByText(/benchmark/i)).toBeInTheDocument()
  })

  it('calls onExport when the export button is clicked', () => {
    const onExport = vi.fn()
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} onExport={onExport} />)
    const exportBtn = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportBtn)
    expect(onExport).toHaveBeenCalledTimes(1)
    // The callback should receive an array of ExportRow objects
    const [rows] = onExport.mock.calls[0] as [Array<Record<string, number>>]
    expect(Array.isArray(rows)).toBe(true)
  })

  it('renders in normalized mode without crashing', () => {
    expect(() =>
      render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} normalizedMode />),
    ).not.toThrow()
  })

  it('shows a % label in normalized mode', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} normalizedMode />)
    // "% Change" appears in the header text in normalized mode
    expect(screen.getByText(/% Change/i)).toBeInTheDocument()
  })

  it('calculates returns for the selected inclusive period and names both boundaries', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} benchmarkPair="ETH/USD" />)
    const start = screen.getByLabelText('Comparison interval start')
    const end = screen.getByLabelText('Comparison interval end')
    fireEvent.change(start, { target: { value: asLocalDateTime(NOW - 1_800_000) } })
    fireEvent.change(end, { target: { value: asLocalDateTime(NOW) } })

    expect(screen.getByText('+$1,000.00')).toBeInTheDocument()
    // Also shown in the pre-chart summary for the same window, so more than one match is expected.
    expect(screen.getAllByText('+1.96%').length).toBeGreaterThan(0)
    expect(screen.getByText(/Observed boundaries:/)).toBeInTheDocument()
    expect(screen.getByLabelText('Rolling beta and volatility window')).toBeInTheDocument()
  })

  it('announces invalid intervals and withholds analytics', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} benchmarkPair="ETH/USD" />)
    fireEvent.change(screen.getByLabelText('Comparison interval start'), {
      target: { value: asLocalDateTime(NOW) },
    })
    fireEvent.change(screen.getByLabelText('Comparison interval end'), {
      target: { value: asLocalDateTime(NOW - 3_600_000) },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/start at or before the end/i)
  })

  it('keeps date controls available when a valid interval has no observations', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} benchmarkPair="ETH/USD" />)
    const gap = asLocalDateTime(NOW - 2_700_000)
    fireEvent.change(screen.getByLabelText('Comparison interval start'), { target: { value: gap } })
    fireEvent.change(screen.getByLabelText('Comparison interval end'), { target: { value: gap } })

    expect(screen.getByText(/no aligned observations/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Comparison interval start')).toBeInTheDocument()
  })

  it('clearly reports insufficient history for rolling beta and volatility regimes', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD', 'ETH/USD']} history={sampleHistory} benchmarkPair="ETH/USD" />)
    expect(screen.getByText('Insufficient data')).toBeInTheDocument()
    expect(screen.getByText(/Insufficient observations to identify volatility regimes/i)).toBeInTheDocument()
  })

  it('keeps interval and rolling-window controls keyboard reachable', async () => {
    const user = userEvent.setup()
    render(
      <MultiPairOverlayChart
        pairs={['BTC/USD', 'ETH/USD']}
        history={sampleHistory}
        benchmarkPair="ETH/USD"
        onExport={vi.fn()}
      />,
    )
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Comparison interval start'))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Comparison interval end'))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Rolling beta and volatility window'))
  })
})
