import { create } from 'zustand'
import type { ConnectionStatus } from '../api/websocket'
import type { RateLimitStatus } from '../api/rateLimit'
import type { LivePriceEntry } from '../types'
import { registerMemoryProbe } from '../utils/memoryProfiler'

/**
 * Zustand store for price-related state.
 *
 * Replaces the high-frequency parts of PriceContext that caused unnecessary
 * re-renders across the component tree. Components only re-render when the
 * slice of state they subscribe to changes, rather than on every context
 * update.
 *
 * REST data fetching is still handled by TanStack Query (see PriceContext.tsx);
 * this store manages WebSocket-driven live prices and connection state.
 */
export interface PriceState {
  /** Live price entries keyed by asset pair, updated optimistically on WebSocket messages. */
  livePrices: Map<string, LivePriceEntry>
  /** Current WebSocket connection status. */
  wsStatus: ConnectionStatus
  /** Current API rate-limit status. */
  rateLimitStatus: RateLimitStatus
  /** Remaining retry window for rate limiting in milliseconds. */
  rateLimitRetryAfterMs: number

  // Actions
  setLivePrices: (updater: (prev: Map<string, LivePriceEntry>) => Map<string, LivePriceEntry>) => void
  setWsStatus: (status: ConnectionStatus) => void
  setRateLimitStatus: (status: RateLimitStatus, retryAfterMs: number) => void
  clearLivePriceEntry: (pair: string) => void
}

export const usePriceStore = create<PriceState>((set) => ({
  livePrices: new Map(),
  wsStatus: 'disconnected',
  rateLimitStatus: 'ok',
  rateLimitRetryAfterMs: 0,

  setLivePrices: (updater) =>
    set((state) => ({ livePrices: updater(state.livePrices) })),

  setWsStatus: (wsStatus) => set({ wsStatus }),

  setRateLimitStatus: (rateLimitStatus, rateLimitRetryAfterMs) =>
    set({ rateLimitStatus, rateLimitRetryAfterMs }),

  clearLivePriceEntry: (pair) =>
    set((state) => {
      if (!state.livePrices.has(pair)) return state
      const next = new Map(state.livePrices)
      next.delete(pair)
      return { livePrices: next }
    }),
}))

// #504 — report live price entry count to the memory profiling harness. The
// store is a module-level singleton, so this probe lives for the app's
// whole lifetime with no unmount to unregister on.
registerMemoryProbe('priceStore', () => usePriceStore.getState().livePrices.size)
