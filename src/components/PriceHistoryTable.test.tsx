import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriceHistoryTable } from './PriceHistoryTable'
import type { PriceHistoryEntry } from '../types'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

const mockHistory: PriceHistoryEntry[] = [
  { price: 50000, timestamp: Date.now() - 120000, confidence: 0.99, sources: ['chainlink'] },
  { price: 51000, timestamp: Date.now() - 60000, confidence: 0.85, sources: ['redstone', 'band'] },
  { price: 49000, timestamp: Date.now(), confidence: 0.7, sources: ['reflector'] },
]

describe('PriceHistoryTable', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(<PriceHistoryTable data={mockHistory} />)
  })

  it('renders a row for every history entry', () => {
    render(<PriceHistoryTable data={mockHistory} />)
    expect(screen.getByText('$50,000.00')).toBeInTheDocument()
    expect(screen.getByText('$51,000.00')).toBeInTheDocument()
    expect(screen.getByText('$49,000.00')).toBeInTheDocument()
  })

  it('renders timestamp, price, confidence, and sources columns', () => {
    render(<PriceHistoryTable data={mockHistory} />)
    expect(screen.getByText('Timestamp')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText('chainlink')).toBeInTheDocument()
    expect(screen.getByText('redstone, band')).toBeInTheDocument()
  })

  it('renders confidence as a percentage', () => {
    render(<PriceHistoryTable data={mockHistory} />)
    expect(screen.getByText('99.0%')).toBeInTheDocument()
    expect(screen.getByText('85.0%')).toBeInTheDocument()
    expect(screen.getByText('70.0%')).toBeInTheDocument()
  })

  it('shows a message when there is no history data', () => {
    render(<PriceHistoryTable data={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('No price history available yet.')
  })

  it('renders with an accessible table name', () => {
    render(<PriceHistoryTable data={mockHistory} />)
    expect(screen.getByRole('table', { name: 'Price history table' })).toBeInTheDocument()
  })

  function bodyRows() {
    return screen.getAllByRole('row').slice(1)
  }

  it('defaults to sorting by timestamp descending (most recent first)', () => {
    render(<PriceHistoryTable data={mockHistory} />)
    const rows = bodyRows()
    // Most recent entry (49000) should be first when sorted by timestamp desc.
    expect(rows[0]).toHaveTextContent('$49,000.00')
    expect(rows[rows.length - 1]).toHaveTextContent('$50,000.00')
  })

  it('sorts by price ascending on header click', async () => {
    const user = userEvent.setup()
    render(<PriceHistoryTable data={mockHistory} />)
    await user.click(screen.getByText('Price'))
    expect(bodyRows()[0]).toHaveTextContent('$49,000.00')
  })

  it('sorts by price descending on double click', async () => {
    const user = userEvent.setup()
    render(<PriceHistoryTable data={mockHistory} />)
    await user.click(screen.getByText('Price'))
    await user.click(screen.getByText('Price'))
    expect(bodyRows()[0]).toHaveTextContent('$51,000.00')
  })

  it('shows aria-sort on the sorted column', async () => {
    const user = userEvent.setup()
    render(<PriceHistoryTable data={mockHistory} />)
    const timestampHeader = screen.getByText('Timestamp').closest('th')
    expect(timestampHeader).toHaveAttribute('aria-sort', 'descending')

    await user.click(screen.getByText('Confidence'))
    const confidenceHeader = screen.getByText('Confidence').closest('th')
    expect(confidenceHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(timestampHeader).toHaveAttribute('aria-sort', 'none')
  })
})
