import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { checkAccessibility } from '../test/accessibility'
import type { PriceResyncProgress } from '../types/realtime'
import { PriceResyncStatus } from './PriceResyncStatus'

function progress(status: PriceResyncProgress['status'], completed: number, failed: number, total = 3) {
  return { status, completed, failed, total, startedAt: 100 }
}

afterEach(cleanup)

describe('PriceResyncStatus', () => {
  it('announces progress while tracked prices are being refreshed', () => {
    render(<PriceResyncStatus progress={progress('syncing', 1, 0)} />)

    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 checked')
  })

  it('reports unavailable refreshes without implying old prices are fresh', () => {
    render(<PriceResyncStatus progress={progress('partial', 3, 1)} />)

    expect(screen.getByRole('status')).toHaveTextContent('2 refreshed; 1 unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('Last available prices remain displayed')
  })

  it('reports a successful refresh and the empty-pair state accessibly', async () => {
    await checkAccessibility(<PriceResyncStatus progress={progress('complete', 3, 0)} />)
    cleanup()
    render(<PriceResyncStatus progress={progress('complete', 0, 0, 0)} />)

    expect(screen.getByRole('status')).toHaveTextContent('No tracked prices are available')
  })

  it('explains that background sync is pending while offline before any run completes', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    render(<PriceResyncStatus progress={null} />)

    expect(screen.getByRole('status')).toHaveTextContent('pending until the connection returns')
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  })

  it('keeps a failed run visible with an accessible status while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const failed = <PriceResyncStatus progress={progress('failed', 3, 3)} />
    render(failed)

    expect(screen.getByRole('status')).toHaveTextContent('unavailable: all 3 refreshes failed')
    await checkAccessibility(failed)
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  })

  it('renders nothing when online with no run and nothing queued', () => {
    const { container } = render(<PriceResyncStatus progress={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
