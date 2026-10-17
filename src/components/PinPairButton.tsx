import { memo, useEffect } from 'react'
import { usePinnedPairs } from '../hooks/usePinnedPairs'
import type { PriceData } from '../types'

interface PinPairButtonProps {
  price: PriceData
}

/**
 * Toggles offline pinning for the pair shown on a detail page (#831).
 *
 * While the pair is pinned, every live price it receives refreshes the stored
 * snapshot, so offline views show the last price the app actually saw.
 */
export const PinPairButton = memo(function PinPairButton({ price }: PinPairButtonProps) {
  const { getPin, pin, syncPrice, unpin } = usePinnedPairs()
  const isPinned = getPin(price.assetPair) !== undefined

  useEffect(() => {
    syncPrice(price)
  }, [price, syncPrice])

  return (
    <button
      type="button"
      aria-pressed={isPinned}
      onClick={() => (isPinned ? unpin(price.assetPair) : pin(price))}
      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        isPinned
          ? 'border-cyan-500/50 text-cyan-300 hover:text-cyan-200'
          : 'border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-500'
      }`}
    >
      {isPinned ? 'Unpin for offline' : 'Pin for offline'}
    </button>
  )
})
