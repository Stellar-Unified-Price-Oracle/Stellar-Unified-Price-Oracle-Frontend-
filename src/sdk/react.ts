import { createContext, createElement, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { PriceData } from '../types'
import { PriceHub } from './observe'
import type { StreamClientOptions, StreamStatus } from './stream'

const HubContext = createContext<PriceHub | null>(null)

export function OracleProvider(props: { options: Omit<StreamClientOptions, 'pairs'>; children?: ReactNode }) {
  const ref = useRef<PriceHub | null>(null)
  if (!ref.current) ref.current = new PriceHub(props.options)
  return createElement(HubContext.Provider, { value: ref.current }, props.children)
}

function useHub(): PriceHub {
  const hub = useContext(HubContext)
  if (!hub) throw new Error('OracleProvider is missing')
  return hub
}

// Hooks use useSyncExternalStore with server snapshots; subscribe() only runs on the client, so SSR never opens a socket.

export function usePrice(pair: string): PriceData | undefined {
  const hub = useHub()
  return useSyncExternalStore(
    (cb) => hub.subscribe(pair, cb),
    () => hub.getLatest(pair),
    () => undefined,
  )
}

export function usePrices(pairs: string[]): Record<string, PriceData | undefined> {
  const hub = useHub()
  const key = pairs.join('|')
  const cache = useRef<{ key: string; version: string; value: Record<string, PriceData | undefined> } | null>(null)
  const snapshot = () => {
    const version = pairs.map((p) => hub.getLatest(p)?.timestamp ?? '').join('|')
    if (!cache.current || cache.current.key !== key || cache.current.version !== version) {
      cache.current = { key, version, value: Object.fromEntries(pairs.map((p) => [p, hub.getLatest(p)])) }
    }
    return cache.current.value
  }
  const empty = useRef<Record<string, PriceData | undefined>>({})
  return useSyncExternalStore(
    (cb) => {
      const offs = pairs.map((p) => hub.subscribe(p, cb))
      return () => offs.forEach((f) => f())
    },
    snapshot,
    () => empty.current,
  )
}

export function useConnectionStatus(): StreamStatus {
  const hub = useHub()
  return useSyncExternalStore((cb) => hub.onStatus(cb), () => hub.status, () => 'idle' as StreamStatus)
}

