import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { PriceHistoryEntry } from '../types'
import { SourceHistoryDrilldown } from './SourceHistoryDrilldown'

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

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

  it('displays the source name in the dialog heading', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /chainlink — history drilldown/i })).toBeInTheDocument()
  })

  it('has aria-modal="true" on the dialog', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /close drilldown/i })
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
    expect(() => render(<SourceHistoryDrilldown source="band" history={[]} onClose={vi.fn()} />)).not.toThrow()
  })

  it('shows total data points count', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)
    expect(screen.getByText('3', { exact: true })).toBeInTheDocument()
  })

  it('displays operator identity and provenance details for a verified source', () => {
    render(<SourceHistoryDrilldown source="chainlink" history={sampleHistory} onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Operator Identity & Provenance' })).toBeInTheDocument()
    expect(screen.getByText('Verified Operator')).toBeInTheDocument()
    expect(screen.getByText(/Chainlink Oracle Network/)).toBeInTheDocument()
    expect(screen.getByText(/Chainlink Labs/)).toBeInTheDocument()
    expect(screen.getByText('Global (Decentralized)')).toBeInTheDocument()
    expect(screen.getByText('Ed25519')).toBeInTheDocument()
    expect(screen.getByText('Formally Audited (v2.4)')).toBeInTheDocument()

    const copyBtn = screen.getByRole('button', { name: 'Copy operator address' })
    expect(copyBtn).toBeInTheDocument()
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVOGO',
    )
  })

  it('displays explicit fallback when source operator is unknown or unregistered', () => {
    render(<SourceHistoryDrilldown source="unknown-source" history={sampleHistory} onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Operator Identity & Provenance' })).toBeInTheDocument()
    expect(screen.getByText('Unregistered Feed')).toBeInTheDocument()
    expect(screen.getByText('Operator identity not reported by API')).toBeInTheDocument()
    expect(screen.getByText('Source-tick provenance unavailable from the API.')).toBeInTheDocument()
  })
})
