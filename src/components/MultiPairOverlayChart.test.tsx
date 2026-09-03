import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MultiPairOverlayChart', () => {
  it('renders without crashing with basic props', () => {
    expect(() =>
      render(
        <MultiPairOverlayChart
          pairs={['BTC/USD', 'ETH/USD']}
          history={sampleHistory}
        />,
      ),
    ).not.toThrow()
  })

  it('shows an empty state when pairs is empty', () => {
    render(<MultiPairOverlayChart pairs={[]} history={{}} />)
    expect(screen.getByText(/no pairs selected/i)).toBeInTheDocument()
  })

  it('shows an empty state when history is empty', () => {
    render(<MultiPairOverlayChart pairs={['BTC/USD']} history={{}} />)
    expect(screen.getByText(/no historical data available/i)).toBeInTheDocument()
  })

  it('renders legend entries for each pair', () => {
    render(
      <MultiPairOverlayChart
        pairs={['BTC/USD', 'ETH/USD']}
        history={sampleHistory}
      />,
    )
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
  })

  it('labels the benchmark pair in the legend', () => {
    render(
      <MultiPairOverlayChart
        pairs={['BTC/USD', 'ETH/USD']}
        history={sampleHistory}
        benchmarkPair="ETH/USD"
      />,
    )
    expect(screen.getByText(/benchmark/i)).toBeInTheDocument()
  })

  it('calls onExport when the export button is clicked', () => {
    const onExport = vi.fn()
    render(
      <MultiPairOverlayChart
        pairs={['BTC/USD', 'ETH/USD']}
        history={sampleHistory}
        onExport={onExport}
      />,
    )
    const exportBtn = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportBtn)
    expect(onExport).toHaveBeenCalledTimes(1)
    // The callback should receive an array of ExportRow objects
    const [rows] = onExport.mock.calls[0] as [Array<Record<string, number>>]
    expect(Array.isArray(rows)).toBe(true)
  })

  it('renders in normalized mode without crashing', () => {
    expect(() =>
      render(
        <MultiPairOverlayChart
          pairs={['BTC/USD', 'ETH/USD']}
          history={sampleHistory}
          normalizedMode
        />,
      ),
    ).not.toThrow()
  })

  it('shows a % label in normalized mode', () => {
    render(
      <MultiPairOverlayChart
        pairs={['BTC/USD', 'ETH/USD']}
        history={sampleHistory}
        normalizedMode
      />,
    )
    // "% Change" appears in the header text in normalized mode
    expect(screen.getByText(/% Change/i)).toBeInTheDocument()
  })
})
