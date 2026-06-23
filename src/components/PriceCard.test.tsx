import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriceCard } from './PriceCard'

afterEach(cleanup)

const mockPrice = {
  assetPair: 'BTC/USD',
  price: 50000.1234,
  timestamp: Date.now(),
  confidence: 0.9876,
  sources: ['chainlink', 'redstone'],
}

describe('PriceCard', () => {
  it('renders asset pair and price', () => {
    render(<PriceCard price={mockPrice} />)
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('50,000.12'))).toBeInTheDocument()
  })

  it('renders confidence percentage', () => {
    render(<PriceCard price={mockPrice} />)
    expect(screen.getByText((content) => content.includes('98.8'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('% confidence'))).toBeInTheDocument()
  })

  it('renders source badges', () => {
    render(<PriceCard price={mockPrice} />)
    const alertButton = screen.getByLabelText('Set alert for BTC/USD')
    expect(alertButton).toBeInTheDocument()
    expect(screen.getByText('chainlink')).toBeInTheDocument()
    expect(screen.getByText('redstone')).toBeInTheDocument()
  })

  it('shows live indicator when isLive is true', () => {
    const { container } = render(<PriceCard price={mockPrice} isLive />)
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
  })

  it('does not show live indicator when isLive is false', () => {
    const { container } = render(<PriceCard price={mockPrice} isLive={false} />)
    expect(container.querySelector('.bg-green-500')).not.toBeInTheDocument()
  })

  it('shows alert indicator when hasAlert is true', () => {
    const { container } = render(<PriceCard price={mockPrice} hasAlert />)
    expect(container.querySelector('.bg-amber-400')).toBeInTheDocument()
  })

  it('does not show alert indicator when hasAlert is false', () => {
    const { container } = render(<PriceCard price={mockPrice} hasAlert={false} />)
    expect(container.querySelector('.bg-amber-400')).not.toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<PriceCard price={mockPrice} onClick={onClick} />)
    const card = screen.getByRole('button', { name: 'View details for BTC/USD' })
    await user.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows Set alert text when no alert', () => {
    render(<PriceCard price={mockPrice} />)
    expect(screen.getByText('Set alert')).toBeInTheDocument()
  })

  it('shows Alert set text when hasAlert', () => {
    render(<PriceCard price={mockPrice} hasAlert />)
    expect(screen.getByText('Alert set')).toBeInTheDocument()
  })

  it('calls onAlertClick without triggering onClick', async () => {
    const onClick = vi.fn()
    const onAlertClick = vi.fn()
    const user = userEvent.setup()
    render(<PriceCard price={mockPrice} onClick={onClick} onAlertClick={onAlertClick} />)
    const alertButton = screen.getByLabelText('Set alert for BTC/USD')
    await user.click(alertButton)
    expect(onAlertClick).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('has accessible aria-label on card', () => {
    render(<PriceCard price={mockPrice} />)
    expect(screen.getByRole('button', { name: 'View details for BTC/USD' })).toBeInTheDocument()
  })

  it('has accessible aria-label on alert button', () => {
    render(<PriceCard price={mockPrice} />)
    expect(screen.getByLabelText('Set alert for BTC/USD')).toBeInTheDocument()
  })

  it('calls onClick on Enter key', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<PriceCard price={mockPrice} onClick={onClick} />)
    const card = screen.getByRole('button', { name: 'View details for BTC/USD' })
    card.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies reduced opacity when isStale is true', () => {
    const { container } = render(<PriceCard price={mockPrice} isStale />)
    const card = container.querySelector('[role="button"]')
    expect(card?.className).toContain('opacity-60')
  })

  it('does not apply reduced opacity when isStale is false', () => {
    const { container } = render(<PriceCard price={mockPrice} isStale={false} />)
    const card = container.querySelector('[role="button"]')
    expect(card?.className).not.toContain('opacity-60')
  })

  it('does not apply reduced opacity when isStale is undefined', () => {
    const { container } = render(<PriceCard price={mockPrice} />)
    const card = container.querySelector('[role="button"]')
    expect(card?.className).not.toContain('opacity-60')
  })
})
