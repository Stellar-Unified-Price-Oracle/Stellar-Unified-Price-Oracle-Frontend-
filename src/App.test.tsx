import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppContent } from './App'
import type { PriceContextValue } from './context/PriceContext'

// Routing is orthogonal to the accessibility side-effects, and useAccessibility pulls in
// PreferencesProvider (IndexedDB + useLocation). Stub it so the route tests stay focused
// on navigation rather than the preferences/IndexedDB wiring.
vi.mock('./hooks/useAccessibility', () => ({ useAccessibility: () => {} }))

vi.mock('./context/PriceContext', () => ({
  usePriceContext: vi.fn(),
}))

// Keep the real data hooks (useSwr, usePriceHistory) but stub the network so the
// PriceDetail route renders with well-formed data instead of the malformed global
// fetch fallback from setup.ts.
vi.mock('./api/rest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/rest')>()
  return {
    ...actual,
    fetchPrice: vi.fn().mockResolvedValue({
      assetPair: 'BTC/USD',
      price: 50000,
      timestamp: 1700040000000,
      confidence: 0.99,
      sources: ['chainlink'],
    }),
    fetchPriceHistory: vi.fn().mockResolvedValue({ history: [] }),
  }
})

const mockPrices = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: 1700040000000, confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: 1700039000000, confidence: 0.95, sources: ['redstone'] },
]

const priceContextValue = {
  prices: mockPrices,
  pricesLoading: false,
  pricesError: null,
  pricesValidating: false,
  livePrices: new Map(),
  wsStatus: 'connected',
  rateLimitStatus: 'ok',
  rateLimitRetryAfterMs: 0,
  refetchPrices: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
} as unknown as PriceContextValue

// Routes are lazy-loaded behind RouteSuspense, which enforces a minimum skeleton time,
// so findBy* assertions need a slightly generous timeout.
const FIND = { timeout: 5000 }

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppContent />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  const { usePriceContext } = await import('./context/PriceContext')
  vi.mocked(usePriceContext).mockReturnValue(priceContextValue)
})

afterEach(cleanup)

describe('App routing', () => {
  it('renders the Dashboard at the index route', async () => {
    renderRoute('/')
    expect(await screen.findByRole('heading', { name: 'Price Oracle Dashboard' }, FIND)).toBeInTheDocument()
  })

  it('renders the API Docs page at /api-docs', async () => {
    renderRoute('/api-docs')
    expect(await screen.findByRole('heading', { name: 'API Documentation' }, FIND)).toBeInTheDocument()
  })

  it('renders the Price Detail page at /prices/:pair', async () => {
    renderRoute('/prices/BTC%2FUSD')
    // The "Go back" control is unique to the Price Detail page and always rendered.
    expect(await screen.findByRole('button', { name: 'Go back to dashboard' }, FIND)).toBeInTheDocument()
  })

  it('renders the 404 NotFound page for an unknown route', async () => {
    renderRoute('/this-route-does-not-exist')
    expect(await screen.findByText('404', {}, FIND)).toBeInTheDocument()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('navigates between routes via the nav bar (route transitions)', async () => {
    const user = userEvent.setup()
    renderRoute('/')
    await screen.findByRole('heading', { name: 'Price Oracle Dashboard' }, FIND)

    await user.click(screen.getByRole('link', { name: 'API Docs' }))
    expect(await screen.findByRole('heading', { name: 'API Documentation' }, FIND)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Price Oracle Dashboard' }, FIND)).toBeInTheDocument()
  })

  it('recovers to the Dashboard from the 404 page via its link', async () => {
    const user = userEvent.setup()
    renderRoute('/nope')
    await screen.findByText('404', {}, FIND)

    await user.click(screen.getByRole('link', { name: 'Back to Dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Price Oracle Dashboard' }, FIND)).toBeInTheDocument()
  })

  it('navigates to Price Detail when a Dashboard price card is clicked', async () => {
    const user = userEvent.setup()
    renderRoute('/')
    const card = await screen.findByRole('button', { name: 'View details for BTC/USD' }, FIND)

    await user.click(card)
    expect(await screen.findByRole('button', { name: 'Go back to dashboard' }, FIND)).toBeInTheDocument()
  })
})
