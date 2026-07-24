import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppContent } from './App'

/**
 * Regression guard for issue #157 ("mount missing context providers in App"),
 * which regressed twice: PriceProvider was imported in App.tsx but never
 * actually rendered around AlertsProvider, so any real usePriceContext()
 * call (e.g. from AlertsProvider or Dashboard) throws at runtime.
 *
 * Unlike App.test.tsx, this file deliberately does NOT mock
 * `./context/PriceContext` — it mocks only PriceProvider's own network
 * dependencies (useSwr, api/rest, api/websocket) so the *real* PriceProvider
 * and the *real* usePriceContext throw-if-missing check are exercised. If
 * PriceProvider is ever dropped from the tree again, `tsc --noEmit` will
 * flag the now-unused import (see #181), but this test independently proves
 * the runtime symptom: rendering the app would throw instead of showing the
 * Dashboard.
 */

vi.mock('./hooks/useAccessibility', () => ({ useAccessibility: () => {} }))

vi.mock('./hooks/useSwr', () => ({
  useSwr: vi.fn(() => ({
    data: [
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
    ],
    loading: false,
    error: null,
    isValidating: false,
    refetch: vi.fn(),
  })),
}))

vi.mock('./api/rest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/rest')>()
  return {
    ...actual,
    fetchAllPrices: vi.fn(),
    fetchPrice: vi.fn().mockResolvedValue({
      assetPair: 'BTC/USD',
      price: 50000,
      timestamp: 1700040000000,
      confidence: 0.99,
      sources: ['chainlink'],
    }),
  }
})

vi.mock('./api/websocket', () => ({
  WebSocketClient: vi.fn(() => ({
    status: 'connected',
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    onStatusChange: vi.fn(() => vi.fn()),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    send: vi.fn(),
  })),
}))

const FIND = { timeout: 5000 }

beforeEach(() => {
  localStorage.clear()
})

afterEach(cleanup)

describe('App provider hierarchy', () => {
  it('renders the Dashboard without throwing when PriceProvider wraps consumers for real', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppContent />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Price Oracle Dashboard' }, FIND),
    ).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
