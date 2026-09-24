import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fetchPricesBatched } from '../api/rest'
import { ATTRIBUTION_RING_BUFFER_SIZE } from '../types'
import type { TickCoalescerStats } from '../utils/tickCoalescer'
import { ToastProvider } from './ToastContext'
import { PriceProvider, usePriceContext } from './PriceContext'

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
let messageHandler:
  | ((msg: {
      type: 'price_update'
      assetPair: string
      price: number
      timestamp: number
      confidence: number
      sources: string[]
    }) => void)
  | null = null

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
  // (arrow functions have no `[[Construct]]`) — RealtimeClient calls
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

// BroadcastChannel exists in jsdom, so a real WsLeaderElection would delay
// opening the socket until its 200ms CLAIM timeout. Force the synchronous
// fallback path instead (channel unavailable → open own socket immediately)
// so tests can drive `messageHandler` right after render. The election
// protocol itself has dedicated coverage in wsLeaderElection.test.ts.
vi.mock('../api/wsLeaderElection', () => ({
  WsLeaderElection: vi.fn(function (callbacks: {
    onBecomeLeader: () => void
    onBecomeFollower: () => void
    onFollowerMessage: (msg: unknown) => void
    onLeaderFallback: () => void
  }) {
    return {
      start: vi.fn(() => callbacks.onLeaderFallback()),
      destroy: vi.fn(),
      relayMessage: vi.fn(),
    }
  }),
}))

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ToastProvider>
        <PriceProvider>{children}</PriceProvider>
      </ToastProvider>
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
      <span data-testid="tick-policy">{JSON.stringify(ctx.tickPolicy ?? null)}</span>
      <span data-testid="attribution-length">{ctx.attributionHistory.get('BTC/USD')?.length ?? 0}</span>
    </div>
  )
}

/** Builds the price_update shape the mocked realtime client hands to the provider. */
function priceUpdate(assetPair: string, price: number) {
  return {
    type: 'price_update' as const,
    assetPair,
    price,
    timestamp: 1700000000000,
    confidence: 0.99,
    sources: ['chainlink'],
  }
}

/**
 * Lets the paint-cadence flush scheduled by the backpressure policy land.
 * Ticks arriving faster than the frame budget are buffered, so a burst is only
 * visible in the DOM after the next animation frame has run.
 */
async function settleFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
}

function readTickPolicy(): TickCoalescerStats {
  return JSON.parse(screen.getByTestId('tick-policy').textContent ?? 'null') as TickCoalescerStats
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
        <ToastProvider>
          <PriceProvider>
            <div>child</div>
          </PriceProvider>
        </ToastProvider>
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
        <ToastProvider>
          <PriceProvider>
            <TestConsumer />
          </PriceProvider>
        </ToastProvider>
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

    expect(() => render(<BadComponent />)).toThrow('usePriceContext must be used within a PriceProvider')
  })
})

/**
 * Renderer backpressure policy under load (#469).
 *
 * The feed can deliver 200 ticks/sec into a 30 Hz renderer. These tests drive a
 * burst through the real provider and assert the two things the policy promises:
 * memory stays bounded by the tracked pair set, and the commits/REST calls the
 * renderer performs are decoupled from the tick rate — while the price actually
 * on screen is still the newest one, not a stale one from mid-burst.
 */
describe('PriceProvider render backpressure (#469)', () => {
  /** 200 ticks/sec for one second, alternating between two pairs. */
  function deliverBurst(totalTicks: number, pairs: string[] = ['BTC/USD', 'ETH/USD']): void {
    act(() => {
      for (let i = 0; i < totalTicks; i++) {
        messageHandler?.(priceUpdate(pairs[i % pairs.length], 50_000 + i))
      }
    })
  }

  it('paints the first tick immediately so a slow feed gains no latency', () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    act(() => {
      messageHandler?.(priceUpdate('BTC/USD', 50_042))
    })

    // Synchronous — the tick did not wait on an animation frame.
    expect(screen.getByTestId('btc-live-price').textContent).toBe('50042')
    expect(screen.getByTestId('btc-live-state').textContent).toBe('optimistic')
  })

  it('coalesces a 200-tick burst into a couple of commits instead of 200', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    deliverBurst(200)
    await settleFrame()

    const stats = readTickPolicy()
    expect(stats.received).toBe(200)
    // Two pairs tracked, so at most two slots are ever occupied — no queue.
    expect(stats.pending).toBeLessThanOrEqual(2)
    expect(stats.peakPending).toBeLessThanOrEqual(2)
    expect(stats.dropped).toBe(0)
    // One immediate flush for the first tick, one for the frame. Not 200.
    expect(stats.flushes).toBeLessThanOrEqual(2)
    // And nothing was lost silently: every tick is either applied or accounted
    // for as superseded.
    expect(stats.flushed + stats.coalesced + stats.dropped + stats.pending).toBe(200)
  })

  it('shows the newest price after a burst, never a stale one from mid-burst', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    deliverBurst(200, ['BTC/USD'])

    // The immediate path already painted tick 0.
    expect(screen.getByTestId('btc-live-price').textContent).toBe('50000')

    await settleFrame()

    // The frame flush jumped straight to tick 199, skipping the 198 in between.
    expect(screen.getByTestId('btc-live-price').textContent).toBe('50199')
  })

  it('collapses the per-tick REST revalidation storm to one request per pair', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    vi.mocked(fetchPricesBatched).mockClear()
    deliverBurst(200, ['BTC/USD'])
    await settleFrame()

    const requests = vi.mocked(fetchPricesBatched).mock.calls.length
    // Previously one fetch per tick — 200 requests/second against the API.
    expect(requests).toBeGreaterThan(0)
    expect(requests).toBeLessThanOrEqual(2)
  })

  it('keeps pending work bounded across a sustained multi-thousand tick flood', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })

    deliverBurst(4_000)
    await settleFrame()

    const stats = readTickPolicy()
    expect(stats.received).toBe(4_000)
    expect(stats.peakPending).toBeLessThanOrEqual(2)
    expect(stats.pending).toBeLessThanOrEqual(2)
    expect(stats.dropped).toBe(0)
    expect(stats.coalesceRatio).toBeGreaterThan(0.9)
  })

  it('still records attribution for every raw tick, not just the painted ones', async () => {
    // 30 ticks, comfortably under the 50-entry ring buffer: if the render policy
    // decimated history, this would only hold a handful of records.
    const tickCount = Math.floor(ATTRIBUTION_RING_BUFFER_SIZE * 0.6)
    render(<TestConsumer />, { wrapper: Wrapper })

    deliverBurst(tickCount, ['BTC/USD'])
    await settleFrame()

    expect(Number(screen.getByTestId('attribution-length').textContent)).toBe(tickCount)
    // ...while the render itself was coalesced.
    expect(readTickPolicy().coalesced).toBeGreaterThan(0)
  })
})
