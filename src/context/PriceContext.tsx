import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WebSocketClient, type ConnectionStatus } from '../api/websocket'
import { WsLeaderElection } from '../api/wsLeaderElection'
import { fetchAllPrices, fetchPricesBatched } from '../api/rest'
import { rateLimitManager, type RateLimitStatus } from '../api/rateLimit'
import { useOutboundQueue } from '../hooks/useOutboundQueue'
import { config } from '../config'
import { computeAttribution, appendToRingBuffer, type SourcePriceState } from '../utils/moveAttribution'
import type { LivePriceEntry, PriceData, MoveAttribution, WsPriceUpdate } from '../types'

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
  /**
   * Per-pair move attribution history (ring-buffer, max ATTRIBUTION_RING_BUFFER_SIZE
   * entries per pair).
   *
   * Each entry describes one WS tick — which sources moved and by how much.
   * The oldest entry is evicted when the buffer is full, keeping memory usage
   * strictly bounded at O(pairs × ATTRIBUTION_RING_BUFFER_SIZE × ~300 bytes).
   */
  attributionHistory: Map<string, MoveAttribution[]>
  /**
   * Whether this tab is the BroadcastChannel WebSocket leader.
   * `true` — this tab owns the real WS connection.
   * `false` — this tab receives relayed updates from the leader tab.
   * `null` — BroadcastChannel is unavailable; every tab owns its own WS (fallback).
   */
  isWsLeader: boolean | null
}

const PriceContext = createContext<PriceContextValue | null>(null)

/**
 * Provides real-time price data and WebSocket lifecycle management to its subtree.
 *
 * On mount it opens a WebSocket connection (or participates in leader election
 * when BroadcastChannel is available), subscribes to all tracked pairs, and
 * applies incoming price updates optimistically. Each update is confirmed against
 * the REST API and rolled back if the values differ. REST polling runs in parallel
 * as a fallback when the WebSocket is disconnected.
 *
 * ### Leader election
 * When BroadcastChannel is available only the elected "leader" tab maintains a
 * real WebSocket. Follower tabs receive relayed `price_update` messages via the
 * channel and apply the same optimistic-update + REST-revalidation logic. When
 * the leader closes, a follower takes over within {@link LEADER_TIMEOUT_MS} ms.
 * When BroadcastChannel is unavailable each tab falls back to its own WS.
 *
 * ### Attribution
 * On each WS tick (whether from a real socket or a relay) per-source price
 * deltas are computed and stored in a bounded ring-buffer exposed as
 * `attributionHistory`.
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

  // ── Leader election state ─────────────────────────────────────────────────
  /** null = fallback (BC unavailable), true = leader, false = follower */
  const [isWsLeader, setIsWsLeader] = useState<boolean | null>(null)
  const electionRef = useRef<WsLeaderElection | null>(null)

  // ── Move attribution state ────────────────────────────────────────────────
  const [attributionHistory, setAttributionHistory] = useState<Map<string, MoveAttribution[]>>(
    new Map(),
  )
  /**
   * Per-pair, per-source last-seen prices — mutable ref so attribution
   * computation can read+write without triggering re-renders.
   * Shape: { assetPair -> { sourceName -> lastPrice } }
   */
  const sourcePriceStateRef = useRef<Map<string, SourcePriceState>>(new Map())
  /**
   * Per-pair last aggregate price — used to compute the aggregate delta.
   */
  const prevAggPriceRef = useRef<Map<string, number>>(new Map())

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

  // ── Core price-update handler (shared by both leader WS and follower relay) ─

  /**
   * Process an incoming price_update — either from the real WebSocket (leader /
   * fallback) or relayed via BroadcastChannel (follower).  Updates attribution
   * ring-buffer, live prices, and triggers REST revalidation.
   */
  const handlePriceUpdate = useCallback(
    (msg: WsPriceUpdate, requestIds: Map<string, number>, timers: Map<string, ReturnType<typeof setTimeout>>) => {
      // ── Attribution computation ───────────────────────────────────────────
      const sourcePriceState = sourcePriceStateRef.current
      if (!sourcePriceState.has(msg.assetPair)) {
        sourcePriceState.set(msg.assetPair, {})
      }
      const prevSourcePrices = sourcePriceState.get(msg.assetPair)!
      const prevAggPrice = prevAggPriceRef.current.get(msg.assetPair) ?? null
      const attribution = computeAttribution(msg, prevSourcePrices, prevAggPrice)
      prevAggPriceRef.current.set(msg.assetPair, msg.price)

      setAttributionHistory((prev) => {
        const existing = prev.get(msg.assetPair) ?? []
        const next = new Map(prev)
        next.set(msg.assetPair, appendToRingBuffer(existing, attribution))
        return next
      })

      // ── Optimistic live price update ──────────────────────────────────────
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
        priceUpdateEmitter.emit(msg.assetPair, entry)
        return next
      })

      clearCleanupTimer(msg.assetPair)
      const requestId = (requestIds.get(msg.assetPair) ?? 0) + 1
      requestIds.set(msg.assetPair, requestId)
      void revalidatePair(msg.assetPair, requestId, requestIds, timers)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── REST revalidation ─────────────────────────────────────────────────────

  const scheduleSettledState = (
    pair: string,
    timers: Map<string, ReturnType<typeof setTimeout>>,
  ) => {
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

  const revalidatePair = async (
    pair: string,
    requestId: number,
    requestIds: Map<string, number>,
    timers: Map<string, ReturnType<typeof setTimeout>>,
  ) => {
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

      scheduleSettledState(pair, timers)
    } catch {
      // Keep optimistic data visible and let polling retry the canonical state.
    }
  }

  // ── WebSocket + leader election setup ──────────────────────────────────────

  useEffect(() => {
    const timers = cleanupTimersRef.current
    const requestIds = requestIdsRef.current

    /**
     * Open a real WebSocket.  Called both by the leader and by fallback tabs.
     * When the tab is the leader it also relays every price_update to followers.
     */
    const openWebSocket = (isLeader: boolean) => {
      const client = new WebSocketClient()
      wsRef.current = client

      const unsubStatus = client.onStatusChange(setWsStatus)
      const unsubMsg = client.onMessage((msg) => {
        if (msg.type === 'price_update') {
          handlePriceUpdate(msg, requestIds, timers)

          // Leader relays to followers
          if (isLeader && electionRef.current) {
            electionRef.current.relayMessage(msg)
          }
        }
      })

      client.connect()

      return () => {
        unsubStatus()
        unsubMsg()
        client.disconnect()
        wsRef.current = null
      }
    }

    let cleanupWs: (() => void) | null = null

    // Set up leader election.  The election callbacks open / close the WS.
    const election = new WsLeaderElection({
      onBecomeLeader: () => {
        setIsWsLeader(true)
        cleanupWs?.()
        cleanupWs = openWebSocket(/* isLeader */ true)
        // Re-subscribe all pairs now that we own the socket
        if (wsRef.current && prices.length > 0) {
          wsRef.current.subscribe(prices.map((p) => p.assetPair))
        }
      },

      onBecomeFollower: () => {
        setIsWsLeader(false)
        cleanupWs?.()
        cleanupWs = null
        wsRef.current = null
        setWsStatus('disconnected')
      },

      onFollowerMessage: (msg) => {
        handlePriceUpdate(msg, requestIds, timers)
      },

      onLeaderFallback: () => {
        // BroadcastChannel unavailable — open own WS and behave normally
        setIsWsLeader(null)
        cleanupWs?.()
        cleanupWs = openWebSocket(/* isLeader */ false)
      },
    })

    electionRef.current = election

    // Register beforeunload to RESIGN so followers can take over immediately
    const handleBeforeUnload = () => election.destroy()
    window.addEventListener('beforeunload', handleBeforeUnload)

    election.start()

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      election.destroy()
      electionRef.current = null
      cleanupWs?.()
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
    // handlePriceUpdate is stable (no deps that change after mount).
    // Including prices here would re-run the effect on every REST poll, which
    // would tear down and re-establish the WS unnecessarily; subscriptions are
    // handled separately in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, handlePriceUpdate])

  // Re-subscribe to all pairs whenever the REST snapshot changes (e.g., new pairs added)
  useEffect(() => {
    if (prices.length > 0 && wsRef.current) {
      wsRef.current.subscribe(prices.map((p) => p.assetPair))
    }
  }, [prices])

  // Prune live prices that have been confirmed by the REST snapshot
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
    attributionHistory,
    isWsLeader,
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
