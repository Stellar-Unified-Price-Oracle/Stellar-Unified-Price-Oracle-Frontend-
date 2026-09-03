import { useMemo } from 'react'
import { usePriceContext, useLivePriceForPair } from '../context/PriceContext'
import type { PriceData } from '../types'

/**
 * Hook to get the current price data for a specific asset pair.
 * Merges REST-fetched data with live WebSocket updates for that pair only.
 * Components using this hook only re-render when this specific pair updates.
 *
 * @param pair - The asset pair to get (e.g., "BTC/USD")
 * @returns The current price data (REST or live, whichever is most recent), or `undefined` if not loaded
 *
 * @example
 * ```tsx
 * function PriceCard({ pair }: { pair: string }) {
 *   const price = useCurrentPrice(pair)
 *   if (!price) return null
 *   return <div>{price.price}</div>
 * }
 * ```
 */
export function useCurrentPrice(pair: string): PriceData | undefined {
  const { prices } = usePriceContext()
  const liveEntry = useLivePriceForPair(pair)

  return useMemo(() => {
    const restPrice = prices.find((p) => p.assetPair === pair)
    if (!restPrice) return undefined

    if (liveEntry && liveEntry.data.timestamp >= restPrice.timestamp) {
      return { ...restPrice, ...liveEntry.data }
    }
    return restPrice
  }, [pair, prices, liveEntry])
}
