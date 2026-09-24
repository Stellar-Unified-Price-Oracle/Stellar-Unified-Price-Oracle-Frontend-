import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PriceProvider } from '../context/PriceContext'
import { AlertsProvider, useAlerts } from '../hooks/useAlerts'
import { ToastProvider } from '../context/ToastContext'
import { makeAlertInput } from '../test/fixtures'
import { PreferencesProvider, usePreferences } from '../preferences/PreferencesContext'

// ---------------------------------------------------------------------------
// PriceContext + useAlerts + WebSocket integration (#329)
// ---------------------------------------------------------------------------
// Unlike useAlerts.test.ts (which mocks usePriceContext entirely) and
// PriceContext.test.tsx (which never mounts a consumer of livePrices beyond a
// bare test component), this exercises the real cross-module wiring: a
// WebSocket price_update flows through the real PriceProvider into real
// AlertsProvider's alert-evaluation effect, driving a real fired-alert entry.

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
      data: [{ assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] }],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    })),
  }
})

vi.mock('../api/rest', () => ({
  fetchAllPrices: vi.fn(),
  // Resolve with data matching the optimistic WS update so the sync state
  // settles to 'confirmed' rather than rolling back — irrelevant to alert
  // firing (which reacts to the optimistic livePrices update directly) but
  // keeps the provider's own confirmation flow from throwing unhandled errors.
  fetchPricesBatched: vi.fn((pair: string) =>
    Promise.resolve({
      assetPair: pair,
      price: 56000,
      timestamp: 1700000001000,
      confidence: 0.99,
      sources: ['chainlink'],
    }),
  ),
}))

// BroadcastChannel exists in jsdom, so a real WsLeaderElection would delay
// opening the socket until its 200ms CLAIM timeout. Force the synchronous
// fallback path instead (channel unavailable → open own socket immediately)
// so the test can drive `messageHandler` right after render.
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

vi.mock('../api/realtimeClient', () => ({
  // A real `function`, not an arrow function, so vitest's mock can be invoked
  // with `new` (PriceProvider does `new RealtimeClient()`).
  RealtimeClient: vi.fn(function RealtimeClient() {
    return {
      status: 'connected',
      diagnostics: {
        retryCount: 0,
        lastConnectedAt: null,
        totalDisconnections: 0,
        transport: 'ws',
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      onMessage: vi.fn((handler: typeof messageHandler) => {
        messageHandler = handler
        return vi.fn()
      }),
      onStatusChange: vi.fn(() => vi.fn()),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    }
  }),
}))

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function AlertsWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ToastProvider>
        <PriceProvider>
          <AlertsProvider>{children}</AlertsProvider>
        </PriceProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('PriceContext + useAlerts + WebSocket integration', () => {
  beforeEach(() => {
    localStorage.clear()
    messageHandler = null
  })

  afterEach(cleanup)

  it('fires an alert and records history when a live WebSocket update crosses the threshold', async () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsWrapper })

    act(() => {
      result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 55000, triggerOnce: true }))
    })
    expect(result.current.alerts).toHaveLength(1)

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 56000,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    await waitFor(() => {
      expect(result.current.alertHistory).toHaveLength(1)
    })
    expect(result.current.alertHistory[0].assetPair).toBe('BTC/USD')
    expect(result.current.alertHistory[0].price).toBe(56000)
    // One-time alert: fired once then auto-disabled.
    expect(result.current.alerts[0].fireCount).toBe(1)
    expect(result.current.alerts[0].active).toBe(false)

    // Persisted to localStorage as part of the same real-hook flow. The write
    // is debounced (#510), so wait for it rather than reading synchronously.
    await waitFor(() => {
      const storedHistory = JSON.parse(localStorage.getItem('alert-history') ?? '[]')
      expect(storedHistory).toHaveLength(1)
    })
  })
})

// ---------------------------------------------------------------------------
// PreferencesContext + IndexedDB persistence (#329)
// ---------------------------------------------------------------------------
// PreferencesContext.test.tsx mocks idbCache.get to always resolve `null`, so
// it never exercises the actual persist-then-reload round trip (preferences
// are persisted to IndexedDB via `idbCache`, not `useLocalStorage` — despite
// the hook's name, `useLocalStorage` is unused by this provider). This test
// backs the mock with a real in-memory store so a value written by one
// mount is genuinely read back by the next.
const idbStore = new Map<string, unknown>()

vi.mock('../hooks/useIndexedDB', () => ({
  idbCache: {
    get: vi.fn((_store: string, key: string) => Promise.resolve(idbStore.get(key) ?? null)),
    set: vi.fn((_store: string, key: string, value: unknown) => {
      idbStore.set(key, value)
      return Promise.resolve()
    }),
    delete: vi.fn(),
    clear: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    fetchWithCache: vi.fn(),
  },
}))

function PreferencesWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </MemoryRouter>
  )
}

describe('PreferencesContext + IndexedDB integration', () => {
  beforeEach(() => idbStore.clear())
  afterEach(cleanup)

  it('persists a preference change and reloads it on remount', async () => {
    const { result, unmount } = renderHook(() => usePreferences(), { wrapper: PreferencesWrapper })

    act(() => result.current.updatePreference('refreshInterval', 30000))
    expect(result.current.preferences.refreshInterval).toBe(30000)

    // Wait for the persist-on-change effect to write to the (fake) IndexedDB store.
    await waitFor(() => expect(idbStore.get('user-preferences')).toBeTruthy())

    unmount()

    const { result: remounted } = renderHook(() => usePreferences(), { wrapper: PreferencesWrapper })
    await waitFor(() => expect(remounted.current.preferences.refreshInterval).toBe(30000))
  })
})
