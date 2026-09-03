import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fetchPricesBatched } from '../api/rest'
import { PriceProvider, usePriceContext } from './PriceContext'

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
let messageHandler: ((msg: {
  type: 'price_update'
  assetPair: string
  price: number
  timestamp: number
  confidence: number
  sources: string[]
}) => void) | null = null

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [
        { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
        { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.95, sources: ['redstone'] },
      ],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    })),
  }
})

vi.mock('../api/rest', () => ({
  fetchAllPrices: vi.fn(),
  fetchPricesBatched: vi.fn(),
}))

vi.mock('../api/websocket', () => ({
  // A `vi.fn()` wrapping an arrow function can't be invoked with `new`
  // (arrow functions have no `[[Construct]]`) — PriceContext calls
  // `new WebSocketClient()`, so this must be a regular `function` that
  // returns the mock instance (constructor return-value override).
  WebSocketClient: vi.fn(function () {
    return {
      status: 'connected',
      connect: mockConnect,
      disconnect: mockDisconnect,
      onMessage: vi.fn((handler) => {
        messageHandler = handler
        return vi.fn()
      }),
      onStatusChange: vi.fn(() => vi.fn()),
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      send: vi.fn(),
    }
  }),
}))

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <PriceProvider>{children}</PriceProvider>
    </QueryClientProvider>
  )
}

function TestConsumer() {
  const ctx = usePriceContext()
  const btcLive = ctx.livePrices.get('BTC/USD')
  return (
    <div>
      <span data-testid="price-count">{ctx.prices.length}</span>
      <span data-testid="loading">{String(ctx.pricesLoading)}</span>
      <span data-testid="ws-status">{ctx.wsStatus}</span>
      <span data-testid="live-size">{ctx.livePrices.size}</span>
      <span data-testid="btc-live-price">{btcLive?.data.price ?? 'none'}</span>
      <span data-testid="btc-live-state">{btcLive?.syncState ?? 'none'}</span>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  messageHandler = null
  vi.mocked(fetchPricesBatched).mockResolvedValue({
    assetPair: 'BTC/USD',
    price: 50010,
    timestamp: 1700000001000,
    confidence: 0.99,
    sources: ['chainlink'],
  })
})

afterEach(cleanup)

describe('PriceProvider', () => {
  it('renders children', () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PriceProvider>
          <div>child</div>
        </PriceProvider>
      </QueryClientProvider>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('provides price context to consumers', () => {
    render(<TestConsumer />, { wrapper: Wrapper })
    expect(screen.getAllByTestId('price-count')[0].textContent).toBe('2')
    expect(screen.getAllByTestId('loading')[0].textContent).toBe('false')
  })

  it('provides default wsStatus as disconnected', () => {
    render(<TestConsumer />, { wrapper: Wrapper })
    expect(screen.getAllByTestId('ws-status')[0].textContent).toBe('disconnected')
  })

  it('applies websocket updates optimistically before REST confirmation', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50010,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    expect(screen.getByTestId('btc-live-price').textContent).toBe('50010')
    expect(screen.getByTestId('btc-live-state').textContent).toBe('optimistic')

    await waitFor(() => {
      expect(screen.getByTestId('btc-live-state').textContent).toBe('confirmed')
    })
  })

  it('patches the REST cache with the WS-confirmed price (#321)', async () => {
    const client = makeQueryClient()
    const setSpy = vi.spyOn(client, 'setQueryData')

    render(
      <QueryClientProvider client={client}>
        <PriceProvider>
          <TestConsumer />
        </PriceProvider>
      </QueryClientProvider>,
    )

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50010,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith(['prices'], expect.any(Function))
    })
  })

  it('rolls back when REST revalidation conflicts with the optimistic update', async () => {
    vi.mocked(fetchPricesBatched).mockResolvedValueOnce({
      assetPair: 'BTC/USD',
      price: 49990,
      timestamp: 1700000002000,
      confidence: 0.97,
      sources: ['redstone'],
    })

    render(<TestConsumer />, { wrapper: Wrapper })

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50010,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('btc-live-state').textContent).toBe('rollback')
    })
    expect(screen.getByTestId('btc-live-price').textContent).toBe('49990')
  })

  // ── #474 — chaos: optimistic rollback after a dropped frame ──────────────
  //
  // A dropped frame is never delivered at all (WebSocketClient already
  // filters malformed/out-of-order frames before they ever reach handlers —
  // see websocket.chaos.test.ts). From PriceContext's perspective the only
  // observable effect of a drop is: the correction that *should* have
  // arrived next simply never does. This proves the REST revalidation path
  // is the safety net for that case — a stale optimistic value never gets
  // stuck forever just because its follow-up frame went missing.
  it('rolls back to REST truth even when the correcting follow-up frame is dropped entirely', async () => {
    // The optimistic WS value is stale (a real price move happened, but the
    // frame carrying it never arrived) — REST revalidation disagrees.
    vi.mocked(fetchPricesBatched).mockResolvedValueOnce({
      assetPair: 'BTC/USD',
      price: 48500,
      timestamp: 1700000005000,
      confidence: 0.96,
      sources: ['band'],
    })

    render(<TestConsumer />, { wrapper: Wrapper })

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50010,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    expect(screen.getByTestId('btc-live-state').textContent).toBe('optimistic')

    // No second message ever arrives for this pair — simulating the
    // correcting frame being silently dropped by an unstable connection.

    await waitFor(() => {
      expect(screen.getByTestId('btc-live-state').textContent).toBe('rollback')
    })
    expect(screen.getByTestId('btc-live-price').textContent).toBe('48500')

    // And the rollback settles cleanly — it doesn't stay flagged forever.
    await waitFor(
      () => {
        expect(screen.getByTestId('btc-live-state').textContent).toBe('synced')
      },
      { timeout: 2000 },
    )
  })
})

describe('usePriceContext', () => {
  it('throws when used outside provider', () => {
    function BadComponent() {
      usePriceContext()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow(
      'usePriceContext must be used within a PriceProvider',
    )
  })
})
