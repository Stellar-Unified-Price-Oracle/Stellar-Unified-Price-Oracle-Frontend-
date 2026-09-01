import type { DivergenceStatus, PriceDivergence } from '../types/onchain'

/**
 * Compares an off-chain feed price against its latest on-chain publish.
 *
 * Status bands, relative to `thresholdPercent`:
 * - `in-sync`  — below half the threshold
 * - `warning`  — at or above half the threshold, but below it
 * - `breached` — at or above the threshold
 *
 * `onChainPrice === 0` is treated as total divergence (100%) rather than dividing
 * by zero, since a real oracle contract never legitimately publishes a zero price.
 */
export function computeDivergence(
  offChainPrice: number,
  onChainPrice: number,
  thresholdPercent: number,
): PriceDivergence {
  const absoluteDelta = offChainPrice - onChainPrice
  const percentageDelta = onChainPrice === 0 ? (offChainPrice === 0 ? 0 : 100) : (absoluteDelta / onChainPrice) * 100

  const magnitude = Math.abs(percentageDelta)
  const status: DivergenceStatus =
    magnitude >= thresholdPercent ? 'breached' : magnitude >= thresholdPercent / 2 ? 'warning' : 'in-sync'

  return { offChainPrice, onChainPrice, absoluteDelta, percentageDelta, status }
}
