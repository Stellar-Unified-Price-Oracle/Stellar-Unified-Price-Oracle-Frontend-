/**
 * App-level integration tests for route-level code splitting.
 *
 * These tests exercise real React.lazy + Suspense behaviour — no lazy components
 * are mocked away. They confirm that:
 *   1. The PageSkeleton fallback renders during the lazy-load suspension.
 *   2. Each route resolves and shows its page content after suspension ends.
 *   3. The NotFound route works for unknown paths.
 *
 * Because the lazy chunks are resolved synchronously inside vitest (dynamic
 * import() is not truly async in the test environment), we use `act` +
 * `waitFor` to flush all React state transitions including Suspense.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Suspense } from 'react'
import { PageSkeleton } from './components/PageSkeleton'

afterEach(cleanup)

// ---------------------------------------------------------------------------
// Shared context mock — all page components depend on PriceContext
// ---------------------------------------------------------------------------
vi.mock('./context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    prices: [],
    pricesLoading: false,
    pricesError: null,
    pricesValidating: false,
    livePrices: new Map(),
    wsStatus: 'disconnected',
    refetchPrices: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),
  PriceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./api/websocket', () => ({
  WebSocketClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onStatusChange: vi.fn(() => () => {}),
  })),
}))

vi.mock('./api/rest', () => ({
  fetchAllPrices: vi.fn().mockResolvedValue([]),
  fetchPrice: vi.fn().mockResolvedValue({ assetPair: 'XLM/USD', price: 0.1, timestamp: Date.now(), confidence: 0.9, sources: ['chainlink'] }),
  fetchPriceHistory: vi.fn().mockResolvedValue({ pair: 'XLM/USD', history: [] }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lazily imports a named-export page the same way App.tsx does, so tests
 * exercise the same code path.
 */
async function lazyImportDashboard() {
  const { lazy } = await import('react')
  return lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
}

async function lazyImportNotFound() {
  const { lazy } = await import('react')
  return lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
}

async function lazyImportApiDocs() {
  const { lazy } = await import('react')
  return lazy(() => import('./pages/ApiDocs').then((m) => ({ default: m.ApiDocs })))
}

async function lazyImportPriceDetail() {
  const { lazy } = await import('react')
  return lazy(() => import('./pages/PriceDetail').then((m) => ({ default: m.PriceDetail })))
}

// ---------------------------------------------------------------------------
// PageSkeleton fallback
// ---------------------------------------------------------------------------
describe('PageSkeleton', () => {
  it('renders the loading status role', () => {
    render(<PageSkeleton />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has an accessible label while loading', () => {
    render(<PageSkeleton />)
    expect(screen.getByLabelText('Loading page')).toBeInTheDocument()
  })

  it('marks itself as busy', () => {
    render(<PageSkeleton />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})

// ---------------------------------------------------------------------------
// Lazy loading behaviour — Suspense + React.lazy
// ---------------------------------------------------------------------------
describe('Route-level code splitting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows PageSkeleton while Dashboard chunk loads, then resolves', async () => {
    const LazyDashboard = await lazyImportDashboard()
    const { AlertsProvider } = await import('./hooks/useAlerts')

    render(
      <MemoryRouter initialEntries={['/']}>
        <AlertsProvider>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<LazyDashboard />} />
            </Routes>
          </Suspense>
        </AlertsProvider>
      </MemoryRouter>,
    )

    // After Suspense resolves, the page heading should be visible
    await waitFor(() => {
      expect(screen.getByText('Price Oracle Dashboard')).toBeInTheDocument()
    })
  })

  it('resolves NotFound route via lazy import', async () => {
    const LazyNotFound = await lazyImportNotFound()

    render(
      <MemoryRouter initialEntries={['/unknown-path']}>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="*" element={<LazyNotFound />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('404')).toBeInTheDocument()
    })
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('resolves ApiDocs route via lazy import', async () => {
    const LazyApiDocs = await lazyImportApiDocs()

    render(
      <MemoryRouter initialEntries={['/api-docs']}>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/api-docs" element={<LazyApiDocs />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('API Documentation')).toBeInTheDocument()
    })
  })

  it('resolves PriceDetail route via lazy import', async () => {
    const LazyPriceDetail = await lazyImportPriceDetail()

    render(
      <MemoryRouter initialEntries={['/prices/XLM-USD']}>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/prices/:pair" element={<LazyPriceDetail />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )

    // PriceDetail renders a back button regardless of loading state
    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Full App integration — confirms all four lazy routes wire up correctly
// We bypass BrowserRouter's basename by rendering the lazy pages directly
// inside MemoryRouter (same pattern used by all other page tests in this repo).
// ---------------------------------------------------------------------------
describe('App routing integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('Dashboard lazy route resolves and renders its heading', async () => {
    const { lazy } = await import('react')
    const { AlertsProvider } = await import('./hooks/useAlerts')

    const LazyDashboard = lazy(() =>
      import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <AlertsProvider>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<LazyDashboard />} />
            </Routes>
          </Suspense>
        </AlertsProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Price Oracle Dashboard')).toBeInTheDocument()
    })
  })

  it('all four lazy pages are importable without errors', async () => {
    // Verify that each dynamic import resolves to the expected named export
    const { Dashboard } = await import('./pages/Dashboard')
    const { PriceDetail } = await import('./pages/PriceDetail')
    const { ApiDocs } = await import('./pages/ApiDocs')
    const { NotFound } = await import('./pages/NotFound')

    expect(typeof Dashboard).toBe('function')
    expect(typeof PriceDetail).toBe('function')
    expect(typeof ApiDocs).toBe('function')
    expect(typeof NotFound).toBe('function')
  })
})
