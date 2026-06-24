import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSwr } from '../hooks/useSwr'
import { WebSocketClient, type ConnectionStatus } from '../api/websocket'
import { fetchAllPrices, fetchPrice } from '../api/rest'
import { config } from '../config'
import type { LivePriceEntry, PriceData } from '../types'

export interface PriceContextValue {
  prices: PriceData[]
  pricesLoading: boolean
  pricesError: string | null
  pricesValidating: boolean
  livePrices: Map<string, LivePriceEntry>
  wsStatus: ConnectionStatus
  refetchPrices: () => void
  subscribe: (pairs: string[]) => void
  unsubscribe: (pairs: string[]) => void
}

const PriceContext = createContext<PriceContextValue | null>(null)

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
      cleanupTimersRef.current.delete(pair)
    }, 1200)
    cleanupTimersRef.current.set(pair, timer)
  }

  const revalidatePair = async (pair: string, requestId: number) => {
    try {
      const restPrice = await fetchPrice(pair)

      if (requestIdsRef.current.get(pair) !== requestId) return

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

  useEffect(() => {
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
        const requestId = (requestIdsRef.current.get(msg.assetPair) ?? 0) + 1
        requestIdsRef.current.set(msg.assetPair, requestId)
        void revalidatePair(msg.assetPair, requestId)
      }
    })

    client.connect()

    return () => {
      unsubStatus()
      unsubMsg()
      client.disconnect()
      wsRef.current = null
      for (const timer of cleanupTimersRef.current.values()) {
        clearTimeout(timer)
      }
      cleanupTimersRef.current.clear()
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

export function usePriceContext(): PriceContextValue {
  const ctx = useContext(PriceContext)
  if (!ctx) {
    throw new Error('usePriceContext must be used within a PriceProvider')
  }
  return ctx
}
