import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Dashboard } from '../pages/Dashboard'
import { PriceDetail } from '../pages/PriceDetail'
import { AlertsProvider } from '../hooks/useAlerts'

afterEach(cleanup)

// Render-count regression guard: a component with the same props/context
// should not re-render more than once per commit. If memoization regresses
// (e.g. a new object/array identity is passed down every render), this
// count silently balloons — this test catches it in CI.
function countCommits(node: React.ReactElement): { commits: number; unmount: () => void } {
  let commits = 0
  const onRender: ProfilerOnRenderCallback = () => {
    commits++
  }
  const { unmount } = render(
    <Profiler id="perf-test" onRender={onRender}>
      {node}
    </Profiler>,
  )
  return { commits, unmount }
}

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    prices: [],
    pricesLoading: false,
    pricesError: null,
    pricesValidating: false,
    livePrices: new Map(),
    wsStatus: 'connected',
    rateLimitStatus: 'ok' as const,
    rateLimitRetryAfterMs: 0,
    refetchPrices: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),
}))

vi.mock('../hooks/useSwr', () => ({ useSwr: vi.fn() }))
vi.mock('../hooks/usePriceHistory', () => ({ usePriceHistory: vi.fn() }))
vi.mock('../components/PriceChart', () => ({ PriceChart: () => <div data-testid="price-chart" /> }))
vi.mock('../components/CsvImportZone', () => ({ CsvImportZone: () => <div data-testid="csv-import-zone" /> }))

const mockPrices = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: 1700000000000, confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: 1700000000000, confidence: 0.95, sources: ['redstone'] },
]

describe('render count regression: Dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'connected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      outboundQueued: 0,
      pricesQueued: false,
      requestsThrottled: false,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      _emitPriceUpdate: vi.fn(),
    })
  })

  it('mounts within a bounded number of commits', () => {
    const { commits, unmount } = countCommits(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // A handful of effect-driven commits (skeleton -> data, analytics marks)
    // is expected; an unbounded number signals a re-render regression.
    expect(commits).toBeGreaterThan(0)
    expect(commits).toBeLessThanOrEqual(4)
    unmount()
  })

  it('mounts and unmounts within a reasonable time budget', () => {
    const start = performance.now()
    const { unmount } = render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    const mountedAt = performance.now()
    unmount()
    const unmountedAt = performance.now()

    // Generous jsdom budget — this guards against gross regressions
    // (e.g. an accidental O(n^2) render loop), not micro-timing.
    expect(mountedAt - start).toBeLessThan(1000)
    expect(unmountedAt - mountedAt).toBeLessThan(500)
  })
})

describe('render count regression: PriceDetail', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { useSwr } = await import('../hooks/useSwr')
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPrices[0],
      loading: false,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })
    vi.mocked(usePriceHistory).mockReturnValue({
      history: [],
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    })
  })

  it('mounts within a bounded number of commits', () => {
    const { commits, unmount } = countCommits(
      <MemoryRouter initialEntries={['/prices/BTC%2FUSD']}>
        <Routes>
          <Route path="/prices/:pair" element={<PriceDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(commits).toBeGreaterThan(0)
    expect(commits).toBeLessThanOrEqual(4)
    unmount()
  })

  it('mounts and unmounts within a reasonable time budget', () => {
    const start = performance.now()
    const { unmount } = render(
      <MemoryRouter initialEntries={['/prices/BTC%2FUSD']}>
        <Routes>
          <Route path="/prices/:pair" element={<PriceDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    const mountedAt = performance.now()
    unmount()
    const unmountedAt = performance.now()

    expect(mountedAt - start).toBeLessThan(1000)
    expect(unmountedAt - mountedAt).toBeLessThan(500)
  })
})
