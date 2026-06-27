import { useEffect, useRef, useState } from 'react'
import { WebSocketClient, type ConnectionStatus } from '../api/websocket'
import type { PriceData } from '../types'

export function useWebSocket(pairs?: string[]) {
  const clientRef = useRef<WebSocketClient | null>(null)
  const [livePrices, setLivePrices] = useState<Map<string, PriceData>>(new Map())
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  useEffect(() => {
    const client = new WebSocketClient()
    clientRef.current = client

    const unsubStatus = client.onStatusChange(setStatus)
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

    client.connect()

    return () => {
      unsubStatus()
      unsubMsg()
      client.disconnect()
      clientRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pairs && pairs.length > 0 && clientRef.current) {
      clientRef.current.subscribe(pairs)
    }
  }, [pairs])

  const subscribe = (assetPairs: string[]) => clientRef.current?.subscribe(assetPairs)
  const unsubscribe = (assetPairs: string[]) => clientRef.current?.unsubscribe(assetPairs)

  return { livePrices, status, subscribe, unsubscribe }
}
