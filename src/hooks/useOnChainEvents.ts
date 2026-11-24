/**
 * useOnChainEvents — polls Soroban RPC `getEvents` with a cursor so on-chain
 * oracle price updates arrive without a full page reload.
 *
 * Issue #1012: Live on-chain price updates via Soroban RPC `getEvents` polling.
 *
 * The hook maintains a ledger cursor, resumes from the last seen ledger on each
 * poll, and reports the lag between the latest on-chain publish and the current
 * clock so callers can show it in the UI.
 */
import { useEffect, useRef, useState } from 'react'
import { rpc as SorobanRpc, scValToNative } from '@stellar/stellar-sdk'
import { getActiveRegistryEntry } from '../lib/onChainClient'
import { UnknownAssetError, UnknownNetworkError } from '../lib/contractRegistry'

/** How often to poll for new contract events (ms). */
const POLL_INTERVAL_MS = 10_000

export interface OnChainEvent {
  /** Ledger sequence this event was emitted in. */
  ledger: number
  /** Unix timestamp (ms) of the ledger close. */
  ledgerClosedAt: number
  /** Raw decoded value from the event. */
  value: unknown
}

export interface OnChainEventsResult {
  /** Latest event received — null until the first event arrives. */
  latestEvent: OnChainEvent | null
  /** Lag in milliseconds between the latest on-chain publish and now. */
  lagMs: number | null
  /** True while the first poll is in flight. */
  loading: boolean
  error: Error | null
}

function rpcUrlForNetwork(network: string): string {
  const env = import.meta.env.VITE_SOROBAN_RPC_URL as string | undefined
  if (env) return env.replace(/\/$/, '')
  if (network === 'mainnet') return 'https://mainnet.sorobanrpc.com'
  if (network === 'futurenet') return 'https://rpc-futurenet.stellar.org'
  return 'https://soroban-testnet.stellar.org'
}

/**
 * Polls Soroban RPC `getEvents` for the oracle contract associated with `pair`
 * and streams the latest price-publish events into `latestEvent`.
 *
 * The first request uses `startLedger = latestLedger - lookbackLedgers` so the
 * most-recent price is available immediately. Subsequent polls resume from the
 * last cursor returned by the RPC, ensuring no duplicate events.
 */
export function useOnChainEvents(pair: string, lookbackLedgers = 100): OnChainEventsResult {
  const [latestEvent, setLatestEvent] = useState<OnChainEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const cursorRef = useRef<string | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const baseAsset = pair.split(/[/-]/)[0]?.trim() ?? ''
    let registryEntry: ReturnType<typeof getActiveRegistryEntry> | null = null
    try {
      registryEntry = getActiveRegistryEntry(baseAsset)
    } catch (e) {
      if (e instanceof UnknownAssetError || e instanceof UnknownNetworkError) {
        // No contract registered for this pair — stop silently.
        setLoading(false)
        return
      }
      setError(e instanceof Error ? e : new Error(String(e)))
      setLoading(false)
      return
    }

    const { contractId, network } = registryEntry
    const server = new SorobanRpc.Server(rpcUrlForNetwork(network))

    let timeoutId: ReturnType<typeof setTimeout>
    let cancelled = false

    const poll = async () => {
      try {
        let startLedger: number | undefined
        if (!cursorRef.current) {
          // First poll — look back a small window to get the latest published price.
          const latest = await server.getLatestLedger()
          startLedger = Math.max(1, latest.sequence - lookbackLedgers)
        }

        const opts: Parameters<typeof server.getEvents>[0] = {
          filters: [{ type: 'contract', contractIds: [contractId] }],
          limit: 50,
        }
        if (cursorRef.current) {
          opts.cursor = cursorRef.current
        } else if (startLedger !== undefined) {
          opts.startLedger = startLedger
        }

        const result = await server.getEvents(opts)

        if (!mountedRef.current || cancelled) return

        if (result.events.length > 0) {
          const last = result.events[result.events.length - 1]
          const closedAtMs = new Date(last.ledgerClosedAt).getTime()
          setLatestEvent({
            ledger: last.ledger,
            ledgerClosedAt: closedAtMs,
            value: scValToNative(last.value),
          })
          cursorRef.current = result.cursor
        }

        setError(null)
      } catch (e) {
        if (!mountedRef.current || cancelled) return
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        if (mountedRef.current && !cancelled) {
          setLoading(false)
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
      mountedRef.current = false
      clearTimeout(timeoutId)
    }
  }, [pair, lookbackLedgers])

  const lagMs =
    latestEvent !== null ? Date.now() - latestEvent.ledgerClosedAt : null

  return { latestEvent, lagMs, loading, error }
}
