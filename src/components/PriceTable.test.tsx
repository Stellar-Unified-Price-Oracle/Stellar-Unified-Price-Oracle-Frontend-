import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriceTable } from './PriceTable'

afterEach(cleanup)

const mockPrices = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.95, sources: ['redstone'] },
  { assetPair: 'XLM/USD', price: 0.1, timestamp: Date.now(), confidence: 0.80, sources: ['band'] },
]

const defaultProps = {
  prices: mockPrices,
  livePairs: new Set<string>(),
  isStale: false,
  onRowClick: vi.fn(),
  onAlertClick: vi.fn(),
  hasAlert: () => false,
}

describe('PriceTable', () => {
  it('renders all rows', () => {
    render(<PriceTable {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'View details for BTC/USD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View details for ETH/USD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View details for XLM/USD' })).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(<PriceTable {...defaultProps} />)
    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const headerTexts = headers.map((h) => h.textContent?.trim())
    expect(headerTexts).toContain('Pair')
    expect(headerTexts.some((t) => t?.includes('Price'))).toBe(true)
    expect(headerTexts.some((t) => t?.includes('Confidence'))).toBe(true)
    expect(headerTexts.some((t) => t?.includes('Sources'))).toBe(true)
    expect(headerTexts.some((t) => t?.includes('Updated'))).toBe(true)
  })

  it('calls onRowClick when a row is clicked', async () => {
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(<PriceTable {...defaultProps} onRowClick={onRowClick} />)
    await user.click(screen.getByRole('button', { name: 'View details for BTC/USD' }))
    expect(onRowClick).toHaveBeenCalledWith('BTC/USD')
  })

  it('calls onAlertClick when alert button is clicked', async () => {
    const onAlertClick = vi.fn()
    const user = userEvent.setup()
    render(<PriceTable {...defaultProps} onAlertClick={onAlertClick} />)
    await user.click(screen.getByLabelText('Set alert for BTC/USD'))
    expect(onAlertClick).toHaveBeenCalled()
  })

  it('shows "Alert set" for pairs with alerts', () => {
    render(<PriceTable {...defaultProps} hasAlert={(p) => p === 'BTC/USD'} />)
    const row = screen.getByRole('button', { name: 'View details for BTC/USD' })
    expect(row.textContent).toContain('Alert set')
  })

  it('sorts by pair ascending by default', () => {
    render(<PriceTable {...defaultProps} />)
    const rows = screen.getAllByRole('button', { name: /View details for/ })
    expect(rows[0]).toHaveAccessibleName('View details for BTC/USD')
    expect(rows[1]).toHaveAccessibleName('View details for ETH/USD')
    expect(rows[2]).toHaveAccessibleName('View details for XLM/USD')
  })

  it('sorts by price when Price header is clicked', async () => {
    const user = userEvent.setup()
    render(<PriceTable {...defaultProps} />)
    // Click the Price column header
    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const priceCol = headers.find((h) => h.textContent?.trim().startsWith('Price'))!
    await user.click(priceCol)
    const rows = screen.getAllByRole('button', { name: /View details for/ })
    // ascending: XLM < ETH < BTC
    expect(rows[0]).toHaveAccessibleName('View details for XLM/USD')
    expect(rows[2]).toHaveAccessibleName('View details for BTC/USD')
  })

  it('toggles sort direction on second click of Price header', async () => {
    const user = userEvent.setup()
    render(<PriceTable {...defaultProps} />)
    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const priceCol = headers.find((h) => h.textContent?.trim().startsWith('Price'))!
    await user.click(priceCol)
    await user.click(priceCol)
    const rows = screen.getAllByRole('button', { name: /View details for/ })
    // descending: BTC > ETH > XLM
    expect(rows[0]).toHaveAccessibleName('View details for BTC/USD')
    expect(rows[2]).toHaveAccessibleName('View details for XLM/USD')
  })

  it('shows live indicator for live pairs', () => {
    render(<PriceTable {...defaultProps} livePairs={new Set(['BTC/USD'])} />)
    expect(screen.getByRole('status', { name: 'Live data' })).toBeInTheDocument()
  })
})
