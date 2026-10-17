/**
 * Base/quote inversion for the pair preview (#810).
 *
 * Inverting `XLM/USD` gives `USD/XLM` at `1 / price`. The preview shows that
 * result before the user switches, and only offers the switch when the
 * inverted pair is one the app tracks, so the switch never lands on an
 * unknown-pair page.
 */
import { isValidAssetPair } from '../types'

const PAIR_PATTERN = /^([A-Za-z0-9]+)([/-])([A-Za-z0-9]+)$/

/** Swaps base and quote, keeping the pair's own separator. Returns null for a malformed pair. */
export function invertPair(pair: string): string | null {
  const match = PAIR_PATTERN.exec(pair)
  if (!match) return null
  const [, base, separator, quote] = match
  return `${quote}${separator}${base}`
}

/** Returns `1 / price`, or null when the price cannot be inverted (zero, negative, NaN, infinite). */
export function invertPrice(price: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  return 1 / price
}

export interface PairInversionPreview {
  /** Pair as currently displayed. */
  from: string
  /** Pair after inversion. */
  to: string
  /** `1 / price`, or null when there is no usable current price. */
  invertedPrice: number | null
  /** Whether the inverted pair is tracked, so switching to it will load data. */
  tracked: boolean
}

/** Builds the preview for a displayed pair, or null when the pair is malformed. */
export function previewPairInversion(pair: string, price: number | null | undefined): PairInversionPreview | null {
  const to = invertPair(pair)
  if (to === null) return null
  return {
    from: pair,
    to,
    invertedPrice: price == null ? null : invertPrice(price),
    tracked: isValidAssetPair(to),
  }
}
