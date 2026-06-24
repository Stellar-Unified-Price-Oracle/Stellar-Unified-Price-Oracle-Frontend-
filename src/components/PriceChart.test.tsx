import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { PriceChart } from './PriceChart'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

const sampleData = [
  { price: 50000, timestamp: Date.now() - 3600000, confidence: 0.99, sources: ['chainlink'] },
  { price: 50100, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
]

describe('PriceChart', () => {
  it('should have no accessibility violations (loading)', async () => {
    await checkAccessibility(<PriceChart data={[]} pair="BTC/USD" loading />)
  })

  it('should have no accessibility violations (empty)', async () => {
    await checkAccessibility(<PriceChart data={[]} pair="BTC/USD" loading={false} />)
  })

  it('renders loading state', () => {
    render(<PriceChart data={[]} pair="BTC/USD" loading />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading chart')
  })

  it('renders empty state', () => {
    render(<PriceChart data={[]} pair="BTC/USD" loading={false} />)
    expect(screen.getByText('No historical data available')).toBeInTheDocument()
  })

  it('renders chart with data', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" loading={false} />)
    expect(screen.getByText('BTC/USD Price History')).toBeInTheDocument()
  })

  it('renders all time range buttons', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    for (const label of ['1H', '24H', '7D', '30D', '1Y']) {
      expect(screen.getByRole('button', { name: `${label} time range` })).toBeInTheDocument()
    }
  })

  it('calls onTimeRangeChange when a range button is clicked', () => {
    const onChange = vi.fn()
    render(<PriceChart data={sampleData} pair="BTC/USD" timeRange="24h" onTimeRangeChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '7D time range' }))
    expect(onChange).toHaveBeenCalledWith('7d')
  })

  it('marks the active time range button as pressed', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" timeRange="7d" onTimeRangeChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '7D time range' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '24H time range' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders full-screen toggle button', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
  })

  it('opens full-screen overlay when toggle is clicked', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument()
  })

  it('closes full-screen overlay with close button', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes full-screen overlay on Escape key', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('full-screen dialog has correct aria attributes', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'BTC/USD full screen chart')
  })

  it('uses internal timeRange state when no external props provided', () => {
    render(<PriceChart data={sampleData} pair="BTC/USD" />)
    // Default is 24h
    expect(screen.getByRole('button', { name: '24H time range' })).toHaveAttribute('aria-pressed', 'true')
    // Clicking 1H updates internal state
    fireEvent.click(screen.getByRole('button', { name: '1H time range' }))
    expect(screen.getByRole('button', { name: '1H time range' })).toHaveAttribute('aria-pressed', 'true')
  })
})
