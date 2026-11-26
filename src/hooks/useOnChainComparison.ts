import { useMemo, useEffect, useRef } from 'react'
import { fetchOnChainPrice, getActiveRegistryEntry } from '../lib/onChainClient'
import { UnknownAssetError, UnknownNetworkError, type ContractRegistryEntry } from '../lib/contractRegistry'
import { computeDivergence } from '../utils/divergence'
import type { PriceDivergence } from '../types/onchain'
import { useSwr } from './useSwr'
import { useOnChainEvents } from './useOnChainEvents'

/** Feed pairs use `XLM/USD` or `XLM-USD`; both separators are accepted. */
const PAIR_SEPARATOR = /[/-]/

function baseAssetForPair(pair: string): string {
  return pair.split(PAIR_SEPARATOR)[0]?.trim() ?? ''
}

const ON_CHAIN_REFRESH_MS = 15_000

export interface OnChainComparisonResult {
  /** `false` when the asset has no registered on-chain contract — nothing to compare. */
  supported: boolean
  registryEntry: ContractRegistryEntry | null
  loading: boolean
  error: Error | null
  divergence: PriceDivergence | null
  onChainPublishedAt: number | null
  onChainLedger: number | null
  /**
   * Lag between the latest on-chain publish and now, in milliseconds.
   * Derived from live `getEvents` polling (issue #1012).
   * Null until the first event arrives or when the asset has no contract.
   */
  lagMs: number | null
}

/**
 * Resolves the on-chain contract for a feed pair (via {@link onChainClient}), fetches
 * its latest published price, and compares it against the live off-chain price.
 *
 * Also polls Soroban RPC `getEvents` so on-chain values update without a reload
 * and the UI can show how far behind the on-chain feed is (issue #1012).
 *
 * Returns `supported: false` — rather than throwing — when the asset has no
 * registered contract, so the comparison panel can render an explanatory state
 * instead of crashing.
 */
export function useOnChainComparison(
  pair: string,
  offChainPrice: number | undefined,
  thresholdPercent: number,
): OnChainComparisonResult {
  const asset = baseAssetForPair(pair)

  const { registryEntry, registryError } = useMemo(() => {
    try {
      return { registryEntry: getActiveRegistryEntry(asset), registryError: null as Error | null }
    } catch (err) {
      if (err instanceof UnknownAssetError || err instanceof UnknownNetworkError) {
        return { registryEntry: null, registryError: null }
      }
      return { registryEntry: null, registryError: err instanceof Error ? err : new Error(String(err)) }
    }
  }, [asset])

  const swrKey = registryEntry ? `onchain:${registryEntry.network}:${registryEntry.asset}` : ''

  const { data, loading, error, refetch } = useSwr(
    swrKey,
    (signal) => fetchOnChainPrice(asset, registryEntry?.network, signal),
    { enabled: registryEntry !== null, refreshInterval: ON_CHAIN_REFRESH_MS, staleTime: 5000, retryCount: 2 },
  )

  // Live event stream — triggers a re-fetch whenever a new publish event arrives
  // so the displayed on-chain price updates without waiting for the REST poll
  // interval (issue #1012).
  const { latestEvent, lagMs } = useOnChainEvents(pair)
  const lastEventLedgerRef = useRef<number | null>(null)
  useEffect(() => {
    if (!latestEvent) return
    if (latestEvent.ledger === lastEventLedgerRef.current) return
    lastEventLedgerRef.current = latestEvent.ledger
    // Trigger an immediate re-fetch of the on-chain price from the REST layer
    // now that we know a new event has been emitted.
    void refetch()
  }, [latestEvent, refetch])

  const divergence =
    data && offChainPrice !== undefined ? computeDivergence(offChainPrice, data.price, thresholdPercent) : null

  return {
    supported: registryEntry !== null,
    registryEntry,
    loading: registryEntry !== null && loading,
    error: registryError ?? error,
    divergence,
    onChainPublishedAt: data?.publishedAt ?? null,
    onChainLedger: data?.ledger ?? null,
    lagMs: registryEntry !== null ? lagMs : null,
  }
}
