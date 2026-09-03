import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AppContent } from './App'
import { PriceProvider } from './context/PriceContext'
import { ToastProvider } from './context/ToastContext'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { ErrorReporterProvider } from './context/ErrorReporterContext'
import { WalletProvider } from './wallet/WalletContext'

/**
 * Regression guard for issue #157 ("mount missing context providers in App"),
 * which regressed twice: PriceProvider was imported in App.tsx but never
 * actually rendered around AlertsProvider, so any real usePriceContext()
 * call (e.g. from AlertsProvider or Dashboard) throws at runtime.
 *
 * This file deliberately does NOT mock `./context/PriceContext` — it mocks only
 * PriceProvider's own network dependencies (TanStack Query, api/rest, api/websocket)
 * so the *real* PriceProvider and the *real* usePriceContext throw-if-missing
 * check are exercised.
 */

vi.mock('./hooks/useAccessibility', () => ({ useAccessibility: () => {} }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [
        { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      ],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    })),
  }
})

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
  // A `vi.fn()` wrapping an arrow function can't be invoked with `new`
  // (arrow functions have no `[[Construct]]`) — PriceProvider does
  // `new WebSocketClient()`, so this must be a regular `function` that
  // returns the mock instance (constructor return-value override).
  WebSocketClient: vi.fn(function () {
    return {
      status: 'connected',
      connect: vi.fn(),
      disconnect: vi.fn(),
      onMessage: vi.fn(() => vi.fn()),
      onStatusChange: vi.fn(() => vi.fn()),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      send: vi.fn(),
    }
  }),
}))

vi.mock('./preferences/PreferencesContext', () => ({
  PreferencesProvider: ({ children }: { children: ReactNode }) => children,
  usePreferences: vi.fn(() => ({
    preferences: {},
    updatePreference: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    clearHistory: vi.fn(),
  })),
}))

const FIND = { timeout: 5000 }

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={makeQueryClient()}>
        <ErrorReporterProvider>
          <PreferencesProvider>
            <ToastProvider>
              <WalletProvider>
                <PriceProvider>
                  {children}
                </PriceProvider>
              </WalletProvider>
            </ToastProvider>
          </PreferencesProvider>
        </ErrorReporterProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(cleanup)

describe('App provider hierarchy', () => {
  it('renders the Dashboard without throwing when PriceProvider wraps consumers for real', async () => {
    render(<AppContent />, { wrapper: Wrapper })

    expect(
      await screen.findByRole('heading', { name: 'Price Oracle Dashboard' }, FIND),
    ).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
