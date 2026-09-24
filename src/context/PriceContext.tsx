import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSwr } from '../hooks/useSwr'
import { WebSocketClient, type ConnectionStatus } from '../api/websocket'
import { fetchAllPrices } from '../api/rest'
import { afterFirstPaint, markStage } from '../perf/startup'
import { config } from '../config'
import type { PriceData } from '../types'

export interface PriceContextValue {
  prices: PriceData[]
  pricesLoading: boolean
  pricesError: string | null
  pricesValidating: boolean
  livePrices: Map<string, PriceData>
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

  const [livePrices, setLivePrices] = useState<Map<string, PriceData>>(new Map())
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocketClient | null>(null)

  useEffect(() => {
    const client = new WebSocketClient()
    wsRef.current = client

    const unsubStatus = client.onStatusChange((status) => {
      setWsStatus(status)
      if (status === 'connected') markStage('live')
    })
    const unsubMsg = client.onMessage((msg) => {
      if (msg.type === 'price_update') {
        setLivePrices((prev) => {
          const next = new Map(prev)
          next.set(msg.assetPair, {
            assetPair: msg.assetPair,
            price: msg.price,
            timestamp: msg.timestamp,
            confidence: msg.confidence,
            sources: msg.sources,
          })
          return next
        })
      }
    })

    // Stage 3 (live): the socket is off the critical path. Hold it until the
    // shell has painted so it does not contend with the first price request.
    let cancelled = false
    afterFirstPaint(() => {
      if (!cancelled) client.connect()
    })

    return () => {
      cancelled = true
      unsubStatus()
      unsubMsg()
      client.disconnect()
      wsRef.current = null
    }
  }, [])

  // Stage 2 (first price): the REST payload has landed and can be rendered.
  useEffect(() => {
    if (prices.length > 0) markStage('first-price', { pairs: prices.length })
  }, [prices.length])

  useEffect(() => {
    if (prices.length > 0 && wsRef.current) {
      // Safe before connect(): the client replays subscriptions on open.
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
