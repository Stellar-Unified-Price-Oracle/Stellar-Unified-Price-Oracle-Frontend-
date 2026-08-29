import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import { MarketOverviewStatsRow, formatChangePct, formatConfidencePct, formatFreshness, formatPrice } from './MarketOverviewStatsRow'
import type { MarketOverviewStats } from '../hooks/useMarketOverviewStats'

afterEach(cleanup)

const baseStats: MarketOverviewStats = {
  changePct: 2.5,
  changeSinceSessionOnly: false,
  highPrice: 50000,
  lowPrice: 0.1,
  highCount: 2,
  lowCount: 1,
  avgConfidence: 0.92,
  avgFreshnessMs: 4_200,
  pairsByFilter: {
    movers: ['BTC/USD'],
    atHigh: ['BTC/USD', 'ETH/USD'],
    atLow: ['XLM/USD'],
    lowConfidence: ['XLM/USD'],
    stale: ['XLM/USD'],
  },
}

describe('format helpers', () => {
  it('formats change percentage with a sign and 2 decimals', () => {
    expect(formatChangePct(2.5)).toBe('+2.50%')
    expect(formatChangePct(-1.234)).toBe('-1.23%')
    expect(formatChangePct(null)).toBe('—')
  })

  it('formats confidence as a percentage', () => {
    expect(formatConfidencePct(0.925)).toBe('92.5%')
    expect(formatConfidencePct(null)).toBe('—')
  })

  it('formats freshness into a human-readable duration', () => {
    expect(formatFreshness(500)).toBe('<1s')
    expect(formatFreshness(5_000)).toBe('5s')
    expect(formatFreshness(120_000)).toBe('2m')
    expect(formatFreshness(7_200_000)).toBe('2h')
    expect(formatFreshness(null)).toBe('—')
  })

  it('formats price with more precision under $1', () => {
    expect(formatPrice(50000)).toBe('$50,000')
    expect(formatPrice(0.1234)).toBe('$0.1234')
    expect(formatPrice(null)).toBe('—')
  })
})

describe('MarketOverviewStatsRow', () => {
  it('has no accessibility violations while loading', async () => {
    await checkAccessibility(
      <MarketOverviewStatsRow stats={baseStats} loading activeFilter={null} onToggleFilter={vi.fn()} />,
    )
  })

  it('has no accessibility violations with data', async () => {
    await checkAccessibility(
      <MarketOverviewStatsRow stats={baseStats} loading={false} activeFilter={null} onToggleFilter={vi.fn()} />,
    )
  })

  it('renders a skeleton (no interactive tiles) while loading', () => {
    render(<MarketOverviewStatsRow stats={baseStats} loading activeFilter={null} onToggleFilter={vi.fn()} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders all five tiles once loaded', () => {
    render(<MarketOverviewStatsRow stats={baseStats} loading={false} activeFilter={null} onToggleFilter={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('calls onToggleFilter with the tile key when clicked', async () => {
    const onToggleFilter = vi.fn()
    render(<MarketOverviewStatsRow stats={baseStats} loading={false} activeFilter={null} onToggleFilter={onToggleFilter} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Avg Confidence'))
    expect(onToggleFilter).toHaveBeenCalledWith('lowConfidence')
  })

  it('marks the active tile as pressed', () => {
    render(<MarketOverviewStatsRow stats={baseStats} loading={false} activeFilter="stale" onToggleFilter={vi.fn()} />)
    const pressedButtons = screen.getAllByRole('button', { pressed: true })
    expect(pressedButtons).toHaveLength(1)
  })

  it('is keyboard operable (tab + Enter triggers the toggle)', async () => {
    const onToggleFilter = vi.fn()
    render(<MarketOverviewStatsRow stats={baseStats} loading={false} activeFilter={null} onToggleFilter={onToggleFilter} />)
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onToggleFilter).toHaveBeenCalledTimes(1)
  })

  it('exposes an aria-live region that reflects the current values', () => {
    const { container } = render(
      <MarketOverviewStatsRow stats={baseStats} loading={false} activeFilter={null} onToggleFilter={vi.fn()} />,
    )
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live?.textContent).toContain('+2.50%')
  })
})
