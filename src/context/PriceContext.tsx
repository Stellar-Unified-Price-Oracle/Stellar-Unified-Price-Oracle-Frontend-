import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSwr } from '../hooks/useSwr'
import { WebSocketClient, type ConnectionStatus } from '../api/websocket'
import { fetchAllPrices, fetchPrice } from '../api/rest'
import { config } from '../config'
import type { LivePriceEntry, PriceData } from '../types'

/** Value exposed by {@link PriceProvider} via React context. */
export interface PriceContextValue {
  /** Latest REST-fetched snapshot of all tracked asset pair prices. */
  prices: PriceData[]
  /** `true` while the initial REST fetch has not yet resolved. */
  pricesLoading: boolean
  /** Error message from the last failed REST fetch, or `null` on success. */
  pricesError: string | null
  /** `true` whenever a background REST revalidation is in flight. */
  pricesValidating: boolean
  /** Live price entries keyed by asset pair, updated optimistically on each WebSocket message. */
  livePrices: Map<string, LivePriceEntry>
  /** Current WebSocket connection status. */
  wsStatus: ConnectionStatus
  /** Trigger an immediate refetch of all prices outside the normal polling cycle. */
  refetchPrices: () => void
  /** Subscribe to live WebSocket updates for the given asset pairs. */
  subscribe: (pairs: string[]) => void
  /** Unsubscribe from WebSocket updates for the given asset pairs. */
  unsubscribe: (pairs: string[]) => void
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
  const { data: prices = [], loading: pricesLoading, error: pricesError, isValidating: pricesValidating, refetch: refetchPrices } = useSwr<PriceData[]>(
    'prices',
    () => fetchAllPrices(),
    { refreshInterval: config.refreshInterval, staleTime: 5000, retryCount: 3 },
  )

  const [livePrices, setLivePrices] = useState<Map<string, LivePriceEntry>>(new Map())
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocketClient | null>(null)
  const requestIdsRef = useRef<Map<string, number>>(new Map())
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearCleanupTimer = (pair: string) => {
    const timer = cleanupTimersRef.current.get(pair)
    if (timer) {
      clearTimeout(timer)
      cleanupTimersRef.current.delete(pair)
    }
  }

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
        const restPrice = await fetchPrice(pair)

        if (requestIds.get(pair) !== requestId) return

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
          next.set(msg.assetPair, {
            data: {
              assetPair: msg.assetPair,
              price: msg.price,
              timestamp: msg.timestamp,
              confidence: msg.confidence,
              sources: msg.sources,
            },
            syncState: 'optimistic',
            flashVersion: (current?.flashVersion ?? 0) + 1,
          })
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
  }, [])

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

  const subscribe = (pairs: string[]) => wsRef.current?.subscribe(pairs)
  const unsubscribe = (pairs: string[]) => wsRef.current?.unsubscribe(pairs)

  const value: PriceContextValue = {
    prices,
    pricesLoading,
    pricesError,
    pricesValidating,
    livePrices,
    wsStatus,
    refetchPrices,
    subscribe,
    unsubscribe,
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
