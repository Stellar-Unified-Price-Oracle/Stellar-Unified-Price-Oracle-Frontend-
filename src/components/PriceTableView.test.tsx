import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriceTableView } from './PriceTableView'
import type { PriceData } from '../types'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

const mockItems: PriceData[] = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now() - 60000, confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now() - 30000, confidence: 0.85, sources: ['redstone', 'band'] },
  { assetPair: 'XLM/USD', price: 0.1, timestamp: Date.now(), confidence: 0.70, sources: ['reflector'] },
]

function setup(overrides: Partial<Parameters<typeof PriceTableView>[0]> = {}) {
  return render(
    <PriceTableView
      items={mockItems}
      livePairs={new Set(['BTC/USD'])}
      isStale={false}
      onRowClick={vi.fn()}
      onAlertClick={vi.fn()}
      hasAlertFn={() => false}
      {...overrides}
    />,
  )
}

describe('PriceTableView', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(
      <PriceTableView
        items={mockItems}
        livePairs={new Set(['BTC/USD'])}
        isStale={false}
        onRowClick={vi.fn()}
        onAlertClick={vi.fn()}
        hasAlertFn={() => false}
      />,
      {
        rules: {
          'nested-interactive': { enabled: false },
        },
      },
    )
  })

  it('renders all rows', () => {
    setup()
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    expect(screen.getByText('XLM/USD')).toBeInTheDocument()
  })

  it('renders sortable column headers', () => {
    setup()
    expect(screen.getByText('Pair')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()
  })

  it('calls onRowClick when row is clicked', async () => {
    const onRowClick = vi.fn()
    setup({ onRowClick })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'View details for BTC/USD' }))
    expect(onRowClick).toHaveBeenCalledWith('BTC/USD')
  })

  it('calls onAlertClick when alert button is clicked', async () => {
    const onAlertClick = vi.fn()
    setup({ onAlertClick })
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Set alert for ETH/USD'))
    expect(onAlertClick).toHaveBeenCalled()
  })

  it('shows "Alert set" for pairs with active alert', () => {
    setup({ hasAlertFn: (pair) => pair === 'BTC/USD' })
    expect(screen.getByLabelText('Set alert for BTC/USD')).toHaveTextContent('Alert set')
    expect(screen.getByLabelText('Set alert for ETH/USD')).toHaveTextContent('Set alert')
  })

  it('shows live indicator for live pairs', () => {
    setup({ livePairs: new Set(['ETH/USD']) })
    const liveIndicators = screen.getAllByLabelText('Live data')
    expect(liveIndicators.length).toBeGreaterThanOrEqual(1)
  })

  it('sorts by price ascending on header click', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByText('Price'))
    const rows = screen.getAllByRole('button').filter((btn) => btn.getAttribute('aria-label')?.startsWith('View details'))
    // XLM (0.1) should come first
    expect(rows[0]).toHaveAttribute('aria-label', 'View details for XLM/USD')
  })

  it('sorts by price descending on double click', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByText('Price'))
    await user.click(screen.getByText('Price'))
    const rows = screen.getAllByRole('button').filter((btn) => btn.getAttribute('aria-label')?.startsWith('View details'))
    // BTC (50000) should come first
    expect(rows[0]).toHaveAttribute('aria-label', 'View details for BTC/USD')
  })

  it('applies reduced opacity when isStale is true', () => {
    setup({ isStale: true })
    const rows = screen.getAllByRole('button').filter((btn) => btn.getAttribute('aria-label')?.startsWith('View details'))
    rows.forEach((row) => expect(row.className).toContain('opacity-60'))
  })

  it('shows aria-sort on sorted column', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByText('Price'))
    const priceHeader = screen.getByText('Price').closest('th')
    expect(priceHeader).toHaveAttribute('aria-sort', 'ascending')
    await user.click(screen.getByText('Price'))
    expect(priceHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('renders with aria-label for table', () => {
    setup()
    expect(screen.getByRole('table', { name: 'Price feeds table' })).toBeInTheDocument()
  })
})
