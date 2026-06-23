import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertBadge } from './AlertBadge'
import type { Alert } from '../types'

afterEach(cleanup)

const baseAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: '1',
  assetPair: 'BTC/USD',
  upperThreshold: 60000,
  lowerThreshold: null,
  triggerOnce: false,
  active: true,
  createdAt: Date.now(),
  lastTriggeredAt: null,
  ...overrides,
})

describe('AlertBadge', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(<AlertBadge count={0} alerts={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders count text', () => {
    render(<AlertBadge count={2} alerts={[baseAlert(), baseAlert({ id: '2' })]} />)
    expect(screen.getByText('2 alerts')).toBeInTheDocument()
  })

  it('renders singular count for 1 alert', () => {
    render(<AlertBadge count={1} alerts={[baseAlert()]} />)
    expect(screen.getByText('1 alert')).toBeInTheDocument()
  })

  it('has accessible label', () => {
    render(<AlertBadge count={2} alerts={[baseAlert(), baseAlert({ id: '2' })]} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', '2 active alerts')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<AlertBadge count={1} alerts={[baseAlert()]} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows up arrow for upper-only alert', () => {
    render(
      <AlertBadge
        count={1}
        alerts={[baseAlert({ lowerThreshold: null, upperThreshold: 60000 })]}
      />,
    )
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('shows down arrow for lower-only alert', () => {
    render(
      <AlertBadge
        count={1}
        alerts={[baseAlert({ upperThreshold: null, lowerThreshold: 30000 })]}
      />,
    )
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('shows up-down arrow for both thresholds', () => {
    render(
      <AlertBadge
        count={1}
        alerts={[baseAlert({ upperThreshold: 60000, lowerThreshold: 30000 })]}
      />,
    )
    expect(screen.getByText('↕')).toBeInTheDocument()
  })
})
