import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WebSocketClient, type ConnectionStatus } from '../api/websocket'
import { fetchAllPrices, fetchPricesBatched } from '../api/rest'
import { rateLimitManager, type RateLimitStatus } from '../api/rateLimit'
import { useOutboundQueue } from '../hooks/useOutboundQueue'
import { config } from '../config'
import type { LivePriceEntry, PriceData } from '../types'

/**
 * Internal event emitter for per-pair live price updates.
 * Prevents components from re-rendering when unrelated pairs update.
 */
class PriceUpdateEmitter {
  private listeners: Map<string, Set<(entry: LivePriceEntry) => void>> = new Map()

  subscribe(pair: string, callback: (entry: LivePriceEntry) => void): () => void {
    if (!this.listeners.has(pair)) {
      this.listeners.set(pair, new Set())
    }
    this.listeners.get(pair)!.add(callback)

    return () => {
      const set = this.listeners.get(pair)
      if (set) {
        set.delete(callback)
        if (set.size === 0) {
          this.listeners.delete(pair)
        }
      }
    }
  }

  emit(pair: string, entry: LivePriceEntry): void {
    const callbacks = this.listeners.get(pair)
    if (callbacks) {
      callbacks.forEach((cb) => cb(entry))
    }
  }
}

const priceUpdateEmitter = new PriceUpdateEmitter()

/** Value exposed by {@link PriceProvider} via React context. */
export interface PriceContextValue {
  /** Latest REST-fetched snapshot of all tracked asset pair prices. */
  prices: PriceData[]
  /** `true` while the initial REST fetch has not yet resolved. */
  pricesLoading: boolean
  /** Error message from the last failed REST fetch, or `null` on success. */
  pricesError: Error | null
  /** `true` whenever a background REST revalidation is in flight. */
  pricesValidating: boolean
  /** Live price entries keyed by asset pair, updated optimistically on each WebSocket message. */
  livePrices: Map<string, LivePriceEntry>
  /** Current WebSocket connection status. */
  wsStatus: ConnectionStatus
  /** Current API rate-limit status. */
  rateLimitStatus: RateLimitStatus
  /** Remaining retry window for rate limiting in milliseconds. */
  rateLimitRetryAfterMs: number
  /**
   * Total outbound requests held by the client-side rate limiter (#330).
   * Distinct from `pricesValidating`: a queued request has not been sent yet.
   */
  outboundQueued: number
  /**
   * `true` when a price request is waiting on the client-side limiter, so a
   * consumer can render "waiting to send" rather than an ordinary spinner.
   */
  pricesQueued: boolean
  /** `true` when the client is queueing requests or paused by a server `Retry-After`. */
  requestsThrottled: boolean
  /** Trigger an immediate refetch of all prices outside the normal polling cycle. */
  refetchPrices: () => void
  /** Subscribe to live WebSocket updates for the given asset pairs. */
  subscribe: (pairs: string[]) => void
  /** Unsubscribe from WebSocket updates for the given asset pairs. */
  unsubscribe: (pairs: string[]) => void
  /** Internal: emit live price update for a specific pair (do not use directly). */
  _emitPriceUpdate: (pair: string, entry: LivePriceEntry) => void
}

const PriceContext = createContext<PriceContextValue | null>(null)

/**
 * Provides real-time price data and WebSocket lifecycle management to its subtree.
 *
 * On mount it opens a WebSocket connection, subscribes to all tracked pairs, and
 * applies incoming price updates optimistically. Each update is confirmed against
 * the REST API and rolled back if the values differ. REST polling runs in parallel
 * as a fallback when the WebSocket is disconnected.
 */
export function PriceProvider({ children }: { children: ReactNode }) {
  const {
    data: prices = [],
    isLoading: pricesLoading,
    error: pricesError,
    isFetching: pricesValidating,
    refetch: refetchPrices,
  } = useQuery<PriceData[], Error>({
    queryKey: ['prices'],
    queryFn: () => fetchAllPrices(),
    refetchInterval: config.refreshInterval,
    staleTime: 5_000,
    retry: 3,
  })

  const queryClient = useQueryClient()

  // Client-side back-pressure (#330). Surfaced through context so any consumer
  // can distinguish "request in flight" from "request queued, not yet sent".
  const outbound = useOutboundQueue()

  const [livePrices, setLivePrices] = useState<Map<string, LivePriceEntry>>(new Map())
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected')
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>(
    rateLimitManager.status,
  )
  const [rateLimitRetryAfterMs, setRateLimitRetryAfterMs] = useState(
    rateLimitManager.retryAfterMs,
  )
  const wsRef = useRef<WebSocketClient | null>(null)
  const requestIdsRef = useRef<Map<string, number>>(new Map())
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearCleanupTimer = (pair: string): void => {
    const timer = cleanupTimersRef.current.get(pair)
    if (timer) {
      clearTimeout(timer)
      cleanupTimersRef.current.delete(pair)
    }
  }

  useEffect(() => {
    const unsubscribeFromRateLimit = rateLimitManager.onStatusChange((status, retryAfterMs) => {
      setRateLimitStatus(status)
      setRateLimitRetryAfterMs(retryAfterMs)
    })

    return unsubscribeFromRateLimit
  }, [])

  useEffect(() => {
    const timers = cleanupTimersRef.current
    const requestIds = requestIdsRef.current

    const scheduleSettledState = (pair: string) => {
      clearCleanupTimer(pair)
      const timer = setTimeout(() => {
        setLivePrices((prev) => {
          const current = prev.get(pair)
          if (!current || current.syncState === 'optimistic') return prev

          const next = new Map(prev)
          next.set(pair, { ...current, syncState: 'synced' })
          return next
        })
        timers.delete(pair)
      }, 1200)
      timers.set(pair, timer)
    }

    const revalidatePair = async (pair: string, requestId: number) => {
      try {
        const restPrice = await fetchPricesBatched(pair)

        if (requestIds.get(pair) !== requestId) return

        // Patch the REST cache with the WS-confirmed value so it doesn't serve a
        // stale entry for this pair until the next poll cycle (#321).
        queryClient.setQueryData<PriceData[]>(['prices'], (old) =>
          old ? old.map((p) => (p.assetPair === pair ? restPrice : p)) : old,
        )

        setLivePrices((prev) => {
          const current = prev.get(pair)
          if (!current) return prev

          const isConfirmed =
            current.data.timestamp === restPrice.timestamp &&
            current.data.price === restPrice.price &&
            current.data.confidence === restPrice.confidence &&
            current.data.sources.join('|') === restPrice.sources.join('|')

          const next = new Map(prev)
          next.set(pair, {
            data: isConfirmed ? current.data : restPrice,
            syncState: isConfirmed ? 'confirmed' : 'rollback',
            flashVersion: current.flashVersion + 1,
          })
          return next
        })

        scheduleSettledState(pair)
      } catch {
        // Keep optimistic data visible and let polling retry the canonical state.
      }
    }

    const client = new WebSocketClient()
    wsRef.current = client

    const unsubStatus = client.onStatusChange(setWsStatus)
    const unsubMsg = client.onMessage((msg) => {
      if (msg.type === 'price_update') {
        setLivePrices((prev) => {
          const next = new Map(prev)
          const current = prev.get(msg.assetPair)
          const entry: LivePriceEntry = {
            data: {
              assetPair: msg.assetPair,
              price: msg.price,
              timestamp: msg.timestamp,
              confidence: msg.confidence,
              sources: msg.sources,
            },
            syncState: 'optimistic',
            flashVersion: (current?.flashVersion ?? 0) + 1,
          }
          next.set(msg.assetPair, entry)
          // Emit update for this specific pair to avoid re-rendering unrelated components
          priceUpdateEmitter.emit(msg.assetPair, entry)
          return next
        })

        clearCleanupTimer(msg.assetPair)
        const requestId = (requestIds.get(msg.assetPair) ?? 0) + 1
        requestIds.set(msg.assetPair, requestId)
        void revalidatePair(msg.assetPair, requestId)
      }
    })

    client.connect()

    return () => {
      unsubStatus()
      unsubMsg()
      client.disconnect()
      wsRef.current = null
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [queryClient])

  useEffect(() => {
    setLivePrices((prev) => {
      if (prev.size === 0) return prev

      let changed = false
      const next = new Map(prev)

      for (const [pair, entry] of prev.entries()) {
        if (entry.syncState === 'optimistic') continue

        const restPrice = prices.find((price) => price.assetPair === pair)
        if (!restPrice) continue

        const matchesRest =
          restPrice.timestamp >= entry.data.timestamp &&
          restPrice.price === entry.data.price &&
          restPrice.confidence === entry.data.confidence &&
          restPrice.sources.join('|') === entry.data.sources.join('|')

        if (matchesRest) {
          next.delete(pair)
          clearCleanupTimer(pair)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [prices])

  useEffect(() => {
    if (prices.length > 0 && wsRef.current) {
      wsRef.current.subscribe(prices.map((p) => p.assetPair))
    }
  }, [prices])

  const subscribe = (pairs: string[]): void => wsRef.current?.subscribe(pairs)
  const unsubscribe = (pairs: string[]): void => wsRef.current?.unsubscribe(pairs)
  const handleRefetchPrices = (): void => { void refetchPrices() }
  const emitPriceUpdate = useCallback((pair: string, entry: LivePriceEntry): void => {
    priceUpdateEmitter.emit(pair, entry)
  }, [])

  const value: PriceContextValue = {
    prices,
    pricesLoading,
    pricesError,
    pricesValidating,
    livePrices,
    wsStatus,
    rateLimitStatus,
    rateLimitRetryAfterMs,
    outboundQueued: outbound.queued,
    pricesQueued: outbound.queuedByGroup.prices > 0,
    requestsThrottled: outbound.degraded,
    refetchPrices: handleRefetchPrices,
    subscribe,
    unsubscribe,
    _emitPriceUpdate: emitPriceUpdate,
  }

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  )
}

/**
 * Returns the price context value.
 * Must be called inside a component that is a descendant of {@link PriceProvider}.
 * Throws if called outside of that tree.
 */
export function usePriceContext(): PriceContextValue {
  const ctx = useContext(PriceContext)
  if (!ctx) {
    throw new Error('usePriceContext must be used within a PriceProvider')
  }
  return ctx
}

/**
 * Hook to subscribe to live price updates for a specific asset pair.
 * Components using this hook only re-render when the specified pair updates,
 * not when other pairs update.
 *
 * @param pair - The asset pair to subscribe to (e.g., "BTC/USD")
 * @returns The current live price entry for the pair, or `undefined` if not available
 *
 * @example
 * ```tsx
 * function PriceDisplay({ pair }: { pair: string }) {
 *   const liveEntry = useLivePriceForPair(pair)
 *   return <div>{liveEntry?.data.price}</div>
 * }
 * ```
 */
export function useLivePriceForPair(pair: string): LivePriceEntry | undefined {
  const { livePrices } = usePriceContext()
  const [liveEntry, setLiveEntry] = useState<LivePriceEntry | undefined>(() =>
    livePrices.get(pair),
  )

  useEffect(() => {
    const unsubscribe = priceUpdateEmitter.subscribe(pair, (entry) => {
      setLiveEntry(entry)
    })
    return unsubscribe
  }, [pair])

  return liveEntry
}
