import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { PriceHistoryEntry } from '../types'
import { SourceHistoryDrilldown } from './SourceHistoryDrilldown'

afterEach(cleanup)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = Date.now()

function makeEntry(sources: string[], ts: number, overrides: Partial<PriceHistoryEntry> = {}): PriceHistoryEntry {
  return { price: 100, timestamp: ts, confidence: 0.95, sources, ...overrides }
}

const sampleHistory: PriceHistoryEntry[] = [
  makeEntry(['chainlink', 'redstone'], NOW - 3_600_000),
  makeEntry(['chainlink'], NOW - 7_200_000),
  makeEntry(['chainlink', 'band'], NOW - 10_800_000),
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SourceHistoryDrilldown', () => {
  it('renders as a dialog', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('displays the source name', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    expect(screen.getByText(/chainlink/i)).toBeInTheDocument()
  })

  it('has aria-modal="true" on the dialog', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders with empty history without crashing', () => {
    expect(() =>
      render(<SourceHistoryDrilldown source="band" history={[]} onClose={vi.fn()} />),
    ).not.toThrow()
  })

  it('shows total data points count', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    // 3 entries → "3" appears somewhere in the stats
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })
})
