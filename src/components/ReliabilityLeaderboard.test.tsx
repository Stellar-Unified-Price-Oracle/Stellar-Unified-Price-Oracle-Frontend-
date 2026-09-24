import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { SourceHealth, PriceHistoryEntry } from '../types'
import { ReliabilityLeaderboard } from './ReliabilityLeaderboard'

afterEach(cleanup)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = Date.now()

function makeHealth(overrides: Partial<SourceHealth> = {}): SourceHealth {
  return {
    source: 'chainlink',
    status: 'healthy',
    lastUpdate: NOW - 5_000,
    latency: 120,
    ...overrides,
  }
}

function makeEntry(sources: string[], ts: number): PriceHistoryEntry {
  return { price: 100, timestamp: ts, confidence: 0.95, sources }
}

const sourceHealths: SourceHealth[] = [
  makeHealth({ source: 'chainlink' }),
  makeHealth({ source: 'redstone', status: 'degraded', latency: 300 }),
]

const priceHistory: Record<string, PriceHistoryEntry[]> = {
  'BTC/USD': [
    makeEntry(['chainlink', 'redstone'], NOW - 1_000),
    makeEntry(['chainlink'], NOW - 2_000),
  ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReliabilityLeaderboard', () => {
  it('renders source names', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} priceHistory={priceHistory} />)
    expect(screen.getByText(/chainlink/i)).toBeInTheDocument()
    expect(screen.getByText(/redstone/i)).toBeInTheDocument()
  })

  it('renders the three time-window buttons', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    expect(screen.getByRole('button', { name: /24/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /7/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /30/i })).toBeInTheDocument()
  })

  it('renders an Export CSV button', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    expect(screen.getByRole('button', { name: /^CSV$/i })).toBeInTheDocument()
  })

  it('renders a Details button for each source', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    const details = screen.getAllByRole('button', { name: /details/i })
    expect(details).toHaveLength(sourceHealths.length)
  })

  it('opens the drilldown modal when Details is clicked', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} priceHistory={priceHistory} />)
    const detailsBtns = screen.getAllByRole('button', { name: /details/i })
    fireEvent.click(detailsBtns[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('highlights the active time window button', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    // The 24h button is active by default
    const btn24 = screen.getByRole('button', { name: /24/i })
    expect(btn24).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches active time window when a button is clicked', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    const btn7d = screen.getByRole('button', { name: /7/i })
    fireEvent.click(btn7d)
    expect(btn7d).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders rank numbers for each row', () => {
    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders with empty sourceHealths without crashing', () => {
    expect(() =>
      render(<ReliabilityLeaderboard sourceHealths={[]} />),
    ).not.toThrow()
  })

  it('shows an empty state message when there are no sources', () => {
    render(<ReliabilityLeaderboard sourceHealths={[]} />)
    // Should show some kind of "no data" message
    expect(screen.getByText(/no source data|no source|no data|no oracle/i)).toBeInTheDocument()
  })

  it('calls exportLeaderboardCsv when Export CSV is clicked', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.fn()
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const a = origCreateElement('a')
        a.click = clickSpy
        return a
      }
      return origCreateElement(tagName)
    })

    render(<ReliabilityLeaderboard sourceHealths={sourceHealths} />)
    fireEvent.click(screen.getByRole('button', { name: /^CSV$/i }))
    expect(createObjectURLSpy).toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})
