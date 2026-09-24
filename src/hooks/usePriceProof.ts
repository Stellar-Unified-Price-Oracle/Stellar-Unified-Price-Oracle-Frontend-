import { fetchPriceProof } from '../api/rest'
import type { PriceProof } from '../types'
import { useSwr } from './useSwr'

/** Return value of {@link usePriceProof}. */
export interface UsePriceProofResult {
  /**
   * `undefined` while the first fetch is in flight, `null` once resolved with
   * no on-chain proof available for this pair/timestamp, otherwise the proof.
   */
  proof: PriceProof | null | undefined
  loading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Fetches the on-chain verification proof for an asset pair's price — the
 * latest record by default, or a specific historical one when `timestamp`
 * is given. See {@link fetchPriceProof} for the empty/unsupported contract.
 *
 * @param pair - Asset pair, or `null` to disable fetching (e.g. before a route param resolves).
 * @param timestamp - Unix ms of a historical record to verify; omit for the latest.
 */
export function usePriceProof(pair: string | null, timestamp?: number): UsePriceProofResult {
  const key = pair ? `proof:${pair}:${timestamp ?? 'latest'}` : ''

  const { data, loading, error, refetch } = useSwr(key, () => fetchPriceProof(pair as string, timestamp), {
    staleTime: 5000,
    retryCount: 1,
    enabled: pair !== null,
  })

  return { proof: data, loading, error, refetch }
}
