import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ConnectionStatus, ConnectionDiagnostics } from '../api/websocket'
import { RealtimeClient } from '../api/realtimeClient'
import { WsLeaderElection } from '../api/wsLeaderElection'
import { fetchAllPrices, fetchPricesBatched } from '../api/rest'
import { rateLimitManager, type RateLimitStatus } from '../api/rateLimit'
import { markStage } from '../perf/startup'
import { useOutboundQueue } from '../hooks/useOutboundQueue'
import { offlinePriceStore, type OfflineSnapshot } from '../services/offlinePriceStore'
import { config } from '../config'
import { computeAttribution, appendToRingBuffer, type SourcePriceState } from '../utils/moveAttribution'
import {
  TICK_POLICY,
  TickCoalescer,
  MAX_PENDING_ATTRIBUTIONS_PER_PAIR,
  createFlushPump,
  type TickCoalescerStats,
} from '../utils/tickCoalescer'
import type { LivePriceEntry, PriceData, MoveAttribution, WsPriceUpdate } from '../types'
import { useToast } from './ToastContext'

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
  /** Current realtime connection status. */
  wsStatus: ConnectionStatus
  /**
   * Connection diagnostics — retry count, negotiated protocol, active transport (#471), pause state (#469).
   * Optional: always provided by {@link PriceProvider}; older consumers/tests may omit it.
   */
  diagnostics?: ConnectionDiagnostics
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
  /** Subscribe to live realtime updates for the given asset pairs. */
  subscribe: (pairs: string[]) => void
  /** Unsubscribe from realtime updates for the given asset pairs. */
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
   * Counters describing how the renderer backpressure policy is treating the
   * incoming tick stream (#469) — how many ticks were received, coalesced to the
   * paint cadence, or dropped, and how many flushes that took.
   *
   * Optional: always provided by {@link PriceProvider}; older consumers/tests may omit it.
   */
  tickPolicy?: TickCoalescerStats
  /**
   * Whether this tab is the BroadcastChannel realtime leader.
   * `true` — this tab owns the real connection.
   * `false` — this tab receives relayed updates from the leader tab.
   * `null` — BroadcastChannel is unavailable; every tab owns its own connection (fallback).
   */
  isWsLeader: boolean | null
  /** `true` when `prices` is being served from the persisted offline snapshot rather than a live REST fetch (#470). */
  isOfflineSnapshot?: boolean
  /** When `isOfflineSnapshot` is true, the timestamp the cached snapshot was saved at; otherwise `null`. */
  offlineSnapshotSavedAt?: number | null
  /** Clears the persisted offline price snapshot (manual "clear cache" action, #470). */
  clearPriceCache?: () => Promise<void>
}

const PriceContext = createContext<PriceContextValue | null>(null)

/**
 * Provides real-time price data and realtime connection lifecycle management to its subtree.
 *
 * On mount it opens a realtime connection (or participates in leader election
 * when BroadcastChannel is available), subscribes to all tracked pairs, and
 * applies incoming price updates optimistically. Each update is confirmed against
 * the REST API and rolled back if the values differ. REST polling runs in parallel
 * as a fallback when the realtime connection is disconnected.
 *
 * ### Leader election
 * When BroadcastChannel is available only the elected "leader" tab maintains a
 * real connection. Follower tabs receive relayed `price_update` messages via the
 * channel and apply the same optimistic-update + REST-revalidation logic. When
 * the leader closes, a follower takes over within {@link LEADER_TIMEOUT_MS} ms.
 * When BroadcastChannel is unavailable each tab falls back to its own connection.
 *
 * The realtime connection itself is managed by {@link RealtimeClient}, which
 * negotiates the WS transport and transparently falls back to SSE when the
 * WebSocket upgrade is blocked (#471).
 *
 * ### Attribution
 * On each WS tick (whether from a real socket or a relay) per-source price
 * deltas are computed and stored in a bounded ring-buffer exposed as
 * `attributionHistory`. Attribution is computed per *raw* tick, before the
 * render-backpressure policy below coalesces anything.
 *
 * ### Render backpressure (#469)
 * The feed can outrun the renderer (e.g. 200 ticks/sec into a 30 Hz paint).
 * Rather than queueing every tick (unbounded memory, a UI that falls further
 * behind every frame) or dropping blindly, ticks are **coalesced latest-wins
 * per asset pair** and applied once per animation frame. Superseded ticks are
 * counted, not lost silently. One consequence: at most one REST revalidation
 * per pair per {@link TICK_POLICY.revalidateIntervalMs}, instead of one per
 * tick. Counters are exposed as `tickPolicy`.
 *
 * See [`tickCoalescer.ts`](../utils/tickCoalescer.ts) for the policy itself and
 * `docs/adr/ADR-004-render-backpressure-policy.md` for the rationale.
 *
 * ### Offline cache (#470)
 * The latest REST-confirmed snapshot is debounce-persisted to IndexedDB and
 * served as the display source — with a stale badge — when the live REST fetch
 * has no data (first load while offline).
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
  /**
   * Latest-wins tick buffer + paint-cadence flush (see the module docs). Created
   * once and held in a ref so its buffered contents survive re-renders.
   */
  const tickCoalescerRef = useRef<TickCoalescer<WsPriceUpdate> | null>(null)
  if (tickCoalescerRef.current === null) tickCoalescerRef.current = new TickCoalescer<WsPriceUpdate>()
  const tickCoalescer = tickCoalescerRef.current
  const [tickPolicy, setTickPolicy] = useState<TickCoalescerStats>(() => tickCoalescer.getStats())
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected')
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({
    retryCount: 0,
    lastConnectedAt: null,
    totalDisconnections: 0,
    transport: 'ws',
  })
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>(rateLimitManager.status)
  const [rateLimitRetryAfterMs, setRateLimitRetryAfterMs] = useState(rateLimitManager.retryAfterMs)

  // ── Leader election state ─────────────────────────────────────────────────
  /** null = fallback (BC unavailable), true = leader, false = follower */
  const [isWsLeader, setIsWsLeader] = useState<boolean | null>(null)
  const electionRef = useRef<WsLeaderElection | null>(null)

  // ── Move attribution state ────────────────────────────────────────────────
  const [attributionHistory, setAttributionHistory] = useState<Map<string, MoveAttribution[]>>(new Map())
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

  const wsRef = useRef<RealtimeClient | null>(null)
  const requestIdsRef = useRef<Map<string, number>>(new Map())
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  /** Pairs with a REST revalidation currently in flight — never fire a second one. */
  const revalidateInFlightRef = useRef<Set<string>>(new Set())
  /** Last time each pair was revalidated — the per-tick REST storm is collapsed to one request per pair per window. */
  const revalidateAtRef = useRef<Map<string, number>>(new Map())
  /**
   * Attribution records accumulated per pair since the last flush. Bounded by
   * {@link MAX_PENDING_ATTRIBUTIONS_PER_PAIR} per pair, so a flood (or a hidden
   * tab, where animation frames stop) cannot grow it without limit.
   */
  const pendingAttributionsRef = useRef<Map<string, MoveAttribution[]>>(new Map())

  // Offline-first price cache (#470): last confirmed snapshot, persisted to IndexedDB
  // and used as the display source when the REST fetch has no data (first offline load).
  const [offlineSnapshot, setOfflineSnapshot] = useState<OfflineSnapshot | null>(null)
  const wasOfflineRef = useRef(false)
  const { addToast } = useToast()

  useEffect(() => {
    let cancelled = false
    void offlinePriceStore.load().then((snapshot) => {
      if (!cancelled) setOfflineSnapshot(snapshot)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Mirror of the latest REST price snapshot so callbacks that run later (e.g.
  // winning leader election and opening a socket) subscribe to the up-to-date
  // pair set instead of the one captured at mount time.
  const pricesRef = useRef<PriceData[]>(prices)
  useEffect(() => {
    pricesRef.current = prices
  }, [prices])

  const clearCleanupTimer = useCallback((pair: string): void => {
    const timer = cleanupTimersRef.current.get(pair)
    if (timer) {
      clearTimeout(timer)
      cleanupTimersRef.current.delete(pair)
    }
  }, [])

  useEffect(() => {
    const unsubscribeFromRateLimit = rateLimitManager.onStatusChange((status, retryAfterMs) => {
      setRateLimitStatus(status)
      setRateLimitRetryAfterMs(retryAfterMs)
    })

    return unsubscribeFromRateLimit
  }, [])

  // ── REST revalidation ─────────────────────────────────────────────────────

  const scheduleSettledState = useCallback(
    (pair: string, timers: Map<string, ReturnType<typeof setTimeout>>) => {
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
    },
    [clearCleanupTimer],
  )

  const revalidatePair = useCallback(
    async (
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
    },
    [queryClient, scheduleSettledState],
  )

  /**
   * Revalidate `pair` against REST, at most once per
   * {@link TICK_POLICY.revalidateIntervalMs} and never while a request for the
   * same pair is still in flight.
   *
   * Before this gate each tick fired its own request — 200 requests/sec under the
   * flood this policy exists to absorb. ADR-002 flagged that cost ("every
   * WebSocket update triggers a REST call"); "REST is canonical" still holds, the
   * confirmation interval is now bounded instead of unbounded.
   */
  const maybeRevalidatePair = useCallback(
    (pair: string, requestIds: Map<string, number>, timers: Map<string, ReturnType<typeof setTimeout>>) => {
      if (revalidateInFlightRef.current.has(pair)) return

      const now = Date.now()
      const lastRevalidatedAt = revalidateAtRef.current.get(pair) ?? 0
      if (now - lastRevalidatedAt < TICK_POLICY.revalidateIntervalMs) return

      revalidateAtRef.current.set(pair, now)
      revalidateInFlightRef.current.add(pair)
      const requestId = (requestIds.get(pair) ?? 0) + 1
      requestIds.set(pair, requestId)
      void revalidatePair(pair, requestId, requestIds, timers).finally(() => {
        revalidateInFlightRef.current.delete(pair)
      })
    },
    [revalidatePair],
  )

  // ── Render backpressure: coalesced flush (#469) ───────────────────────────

  /**
   * Applies one coalesced batch of ticks.
   *
   * Every `setState` here is issued in the same tick, so React commits the whole
   * batch as a single render — that is the point of the policy. Attribution
   * records were accumulated per raw tick before coalescing, so the ring-buffer
   * history is not decimated by this; only the commit count is.
   */
  const applyTickBatch = useCallback(
    (batch: Array<[string, WsPriceUpdate]>) => {
      const timers = cleanupTimersRef.current
      const requestIds = requestIdsRef.current

      // ── Optimistic live price update (latest tick per pair) ──────────────
      setLivePrices((prev) => {
        const next = new Map(prev)
        for (const [pair, msg] of batch) {
          const current = prev.get(pair)
          const entry: LivePriceEntry = {
            data: {
              assetPair: pair,
              price: msg.price,
              timestamp: msg.timestamp,
              confidence: msg.confidence,
              sources: msg.sources,
            },
            syncState: 'optimistic',
            flashVersion: (current?.flashVersion ?? 0) + 1,
          }
          next.set(pair, entry)
          priceUpdateEmitter.emit(pair, entry)
        }
        return next
      })

      // ── Attribution: one commit for every record buffered this frame ─────
      // Snapshot (and clear) before handing anything to React: a `setState`
      // updater is not guaranteed to run before the next tick arrives, so the
      // updater must not read a buffer that the ingest path keeps mutating.
      const pendingAttributions = pendingAttributionsRef.current
      if (pendingAttributions.size > 0) {
        const recordsByPair = new Map(pendingAttributions)
        pendingAttributions.clear()
        setAttributionHistory((prev) => {
          const next = new Map(prev)
          for (const [pair, records] of recordsByPair) {
            next.set(pair, records.reduce(appendToRingBuffer, prev.get(pair) ?? []))
          }
          return next
        })
      }

      for (const [pair] of batch) {
        clearCleanupTimer(pair)
        maybeRevalidatePair(pair, requestIds, timers)
      }

      setTickPolicy(tickCoalescer.getStats())
    },
    [clearCleanupTimer, maybeRevalidatePair, tickCoalescer],
  )

  const flushPump = useMemo(() => createFlushPump(tickCoalescer, applyTickBatch), [tickCoalescer, applyTickBatch])

  // Abandon any frame-scheduled flush when the provider unmounts.
  useEffect(() => () => flushPump.stop(), [flushPump])

  /**
   * Process an incoming price_update — either from the real WebSocket (leader /
   * fallback) or relayed via BroadcastChannel (follower).
   *
   * Attribution is computed eagerly, once per raw tick: it is pure arithmetic
   * with no React commit, so coalescing must not skip it. The live price, by
   * contrast, is last-writer-wins state — an intermediate price nobody painted
   * has no observer — so it goes through the latest-wins coalescer and is
   * applied on the paint cadence.
   */
  const handlePriceUpdate = useCallback(
    (msg: WsPriceUpdate) => {
      // ── Attribution computation (per raw tick) ────────────────────────────
      const sourcePriceState = sourcePriceStateRef.current
      if (!sourcePriceState.has(msg.assetPair)) {
        sourcePriceState.set(msg.assetPair, {})
      }
      const prevSourcePrices = sourcePriceState.get(msg.assetPair)!
      const prevAggPrice = prevAggPriceRef.current.get(msg.assetPair) ?? null
      const attribution = computeAttribution(msg, prevSourcePrices, prevAggPrice)
      prevAggPriceRef.current.set(msg.assetPair, msg.price)

      const pendingAttributions = pendingAttributionsRef.current
      const buffered = pendingAttributions.get(msg.assetPair)
      if (buffered) {
        // A single flush can never retain more than the ring buffer holds, so
        // buffering beyond that would only evict records we just collected.
        // This is also what keeps the map bounded when animation frames stop
        // (a hidden tab keeps coalescing, but never accumulates).
        if (buffered.length >= MAX_PENDING_ATTRIBUTIONS_PER_PAIR) buffered.shift()
        buffered.push(attribution)
      } else {
        pendingAttributions.set(msg.assetPair, [attribution])
      }

      // ── Latest-wins coalescing for the live-price render ──────────────────
      tickCoalescer.enqueue(msg.assetPair, msg)
      flushPump.request()
    },
    [tickCoalescer, flushPump],
  )

  // ── Realtime connection + leader election setup ───────────────────────────

  useEffect(() => {
    const timers = cleanupTimersRef.current

    /**
     * Open a real realtime connection.  Called both by the leader and by
     * fallback tabs.  When the tab is the leader it also relays every
     * price_update to followers.
     */
    const openWebSocket = (isLeader: boolean) => {
      const client = new RealtimeClient()
      wsRef.current = client

      const unsubStatus = client.onStatusChange((status) => {
        setWsStatus(status)
        setDiagnostics(client.diagnostics)
        // Stage 3 (live): the realtime connection is up.
        if (status === 'connected') markStage('live')
      })
      const unsubMsg = client.onMessage((msg) => {
        if (msg.type === 'price_update') {
          handlePriceUpdate(msg)

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
        if (wsRef.current && pricesRef.current.length > 0) {
          wsRef.current.subscribe(pricesRef.current.map((p) => p.assetPair))
        }
      },

      onBecomeFollower: () => {
        setIsWsLeader(false)
        cleanupWs?.()
        cleanupWs = null
        wsRef.current = null
        setWsStatus('disconnected')
        setDiagnostics({ retryCount: 0, lastConnectedAt: null, totalDisconnections: 0 })
      },

      onFollowerMessage: (msg) => {
        handlePriceUpdate(msg)
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
    // handlePriceUpdate is identity-stable across renders (every callback it
    // closes over is memoized), so this effect runs once. Including prices here
    // would re-run it on every REST poll, tearing down and re-establishing the
    // WS unnecessarily; subscriptions are handled separately in the effect below.
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
  }, [prices, clearCleanupTimer])

  // Offline-first (#470): debounced persist of the latest REST-confirmed snapshot,
  // bounded by the shared IndexedDB LRU cache and read back on the next disconnect/reload.
  useEffect(() => {
    offlinePriceStore.persist(prices)
  }, [prices])

  // REST has no data (first load while offline, or the fetch failed) — fall back to the
  // last persisted snapshot so the dashboard renders last-known prices instead of going blank.
  const isOfflineSnapshot = prices.length === 0 && !pricesLoading && (offlineSnapshot?.prices.length ?? 0) > 0
  const displayPrices = prices.length > 0 ? prices : (offlineSnapshot?.prices ?? prices)

  // Reconciliation: once REST data comes back after a spell showing the offline
  // snapshot, surface which pairs changed while we were disconnected (#470).
  useEffect(() => {
    if (isOfflineSnapshot) {
      wasOfflineRef.current = true
      return
    }
    if (!wasOfflineRef.current || prices.length === 0 || !offlineSnapshot) return
    wasOfflineRef.current = false

    const cachedByPair = new Map(offlineSnapshot.prices.map((p) => [p.assetPair, p]))
    const updatedPairs = prices.filter((p) => {
      const cached = cachedByPair.get(p.assetPair)
      return !cached || p.timestamp > cached.timestamp
    })
    if (updatedPairs.length > 0) {
      const preview = updatedPairs
        .slice(0, 3)
        .map((p) => p.assetPair)
        .join(', ')
      addToast({
        type: 'info',
        message: `Back online — ${updatedPairs.length} pair${updatedPairs.length === 1 ? '' : 's'} updated while offline (${preview}${updatedPairs.length > 3 ? '…' : ''}).`,
        priority: 'normal',
      })
    }
  }, [isOfflineSnapshot, prices, offlineSnapshot, addToast])

  const subscribe = (pairs: string[]): void => wsRef.current?.subscribe(pairs)
  const unsubscribe = (pairs: string[]): void => wsRef.current?.unsubscribe(pairs)
  const handleRefetchPrices = (): void => {
    void refetchPrices()
  }
  const emitPriceUpdate = useCallback((pair: string, entry: LivePriceEntry): void => {
    priceUpdateEmitter.emit(pair, entry)
  }, [])
  const clearPriceCache = useCallback(async (): Promise<void> => {
    await offlinePriceStore.clear()
    setOfflineSnapshot(null)
  }, [])

  const value: PriceContextValue = {
    prices: displayPrices,
    pricesLoading,
    pricesError,
    pricesValidating,
    livePrices,
    wsStatus,
    diagnostics,
    rateLimitStatus,
    rateLimitRetryAfterMs,
    tickPolicy,
    outboundQueued: outbound.queued,
    pricesQueued: outbound.queuedByGroup.prices > 0,
    requestsThrottled: outbound.degraded,
    refetchPrices: handleRefetchPrices,
    subscribe,
    unsubscribe,
    _emitPriceUpdate: emitPriceUpdate,
    attributionHistory,
    isWsLeader,
    isOfflineSnapshot,
    offlineSnapshotSavedAt: offlineSnapshot?.savedAt ?? null,
    clearPriceCache,
  }

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>
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
  const [liveEntry, setLiveEntry] = useState<LivePriceEntry | undefined>(() => livePrices.get(pair))

  useEffect(() => {
    const unsubscribe = priceUpdateEmitter.subscribe(pair, (entry) => {
      setLiveEntry(entry)
    })
    return unsubscribe
  }, [pair])

  return liveEntry
}
