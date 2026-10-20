import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PairInversionPreview } from './PairInversionPreview'

afterEach(cleanup)

describe('PairInversionPreview (#810)', () => {
  it('shows the inverted pair and price, then switches only when the user confirms', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    render(<PairInversionPreview pair="USD/XLM" price={8} onSwitch={onSwitch} />)

    const toggle = screen.getByRole('button', { name: 'Preview inverted pair' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/inverts to/)).not.toBeInTheDocument()

    await user.click(toggle)

    expect(screen.getByRole('button', { name: 'Hide inverted pair' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('XLM/USD')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 XLM/USD ≈ 0.125')
    expect(onSwitch).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Switch to XLM/USD' }))
    expect(onSwitch).toHaveBeenCalledWith('XLM/USD')
  })

  it('explains why switching is unavailable when the inverted pair is not tracked', async () => {
    const user = userEvent.setup()
    render(<PairInversionPreview pair="XLM/USD" price={0.12} onSwitch={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Preview inverted pair' }))

    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument()
    expect(
      screen.getByText(/USD\/XLM is not tracked, so switching to it would show an unknown pair/),
    ).toBeInTheDocument()
  })

  it('keeps the switch disabled and announces the gap when there is no current price', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    render(<PairInversionPreview pair="USD/XLM" price={null} onSwitch={onSwitch} />)

    await user.click(screen.getByRole('button', { name: 'Preview inverted pair' }))

    expect(screen.getByRole('status')).toHaveTextContent('No current price for USD/XLM')
    const switchButton = screen.getByRole('button', { name: 'Switch to XLM/USD' })
    expect(switchButton).toBeDisabled()
    await user.click(switchButton)
    expect(onSwitch).not.toHaveBeenCalled()
  })

  it('collapses the preview again when the toggle is pressed a second time', async () => {
    const user = userEvent.setup()
    render(<PairInversionPreview pair="USD/XLM" price={8} onSwitch={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Preview inverted pair' }))
    await user.click(screen.getByRole('button', { name: 'Hide inverted pair' }))

    expect(screen.getByRole('button', { name: 'Preview inverted pair' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument()
  })
})
