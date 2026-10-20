import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import { STORAGE_KEYS } from '../utils/storage'
import type { PriceData } from '../types'
import { PinPairButton } from './PinPairButton'

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
})

const price = {
  assetPair: 'XLM/USD',
  price: 0.12,
  timestamp: 1_700_000_000_000,
  confidence: 0.9,
  sources: ['chainlink'],
} as PriceData

function storedPins(): Array<{ assetPair: string }> {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedPairs) ?? '[]')
}

describe('PinPairButton', () => {
  it('starts unpinned and reports that state through aria-pressed', () => {
    render(<PinPairButton price={price} />)
    const button = screen.getByRole('button', { name: 'Pin for offline' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('pins the pair on click and persists the snapshot', async () => {
    const user = userEvent.setup()
    render(<PinPairButton price={price} />)

    await user.click(screen.getByRole('button', { name: 'Pin for offline' }))

    expect(screen.getByRole('button', { name: 'Unpin for offline' })).toHaveAttribute('aria-pressed', 'true')
    expect(storedPins().map((p) => p.assetPair)).toEqual(['XLM/USD'])
  })

  it('unpins on a second click and removes the stored snapshot', async () => {
    const user = userEvent.setup()
    render(<PinPairButton price={price} />)

    await user.click(screen.getByRole('button', { name: 'Pin for offline' }))
    await user.click(screen.getByRole('button', { name: 'Unpin for offline' }))

    expect(screen.getByRole('button', { name: 'Pin for offline' })).toHaveAttribute('aria-pressed', 'false')
    expect(storedPins()).toEqual([])
  })

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup()
    render(<PinPairButton price={price} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Pin for offline' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(storedPins()).toHaveLength(1)
  })

  it('keeps a pinned snapshot fresh when live prices arrive', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PinPairButton price={price} />)
    await user.click(screen.getByRole('button', { name: 'Pin for offline' }))

    rerender(<PinPairButton price={{ ...price, price: 0.2, timestamp: price.timestamp + 60_000 }} />)

    await waitFor(() => {
      const [pin] = JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedPairs) ?? '[]')
      expect(pin.price).toBe(0.2)
    })
  })

  it('does not write a snapshot for an unpinned pair when live prices arrive', () => {
    render(<PinPairButton price={price} />)
    expect(localStorage.getItem(STORAGE_KEYS.pinnedPairs)).toBeNull()
  })

  it('has no accessibility violations in either state', async () => {
    await checkAccessibility(<PinPairButton price={price} />)

    localStorage.setItem(STORAGE_KEYS.pinnedPairs, JSON.stringify([{ ...price, savedAt: 1 }]))
    cleanup()
    await checkAccessibility(<PinPairButton price={price} />)
  })
})
