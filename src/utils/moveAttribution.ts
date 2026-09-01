/**
 * Move attribution utilities for computing per-source price deltas on each
 * WebSocket price update.
 *
 * ### Memory model
 * Attribution records are kept in a ring-buffer per asset pair inside
 * PriceContext. The buffer holds at most {@link ATTRIBUTION_RING_BUFFER_SIZE}
 * entries. When the buffer is full the oldest entry is evicted before the new
 * one is pushed, so memory usage is strictly bounded:
 *
 *   O(pairs × ATTRIBUTION_RING_BUFFER_SIZE × ~300 bytes) ≈ 60 KB worst case
 *   (4 pairs × 50 entries × 300 B)
 *
 * This budget is documented alongside the constant in `types/price.ts`.
 */

import type { MoveAttribution, SourceDelta, WsPriceUpdate } from '../types'
import { ATTRIBUTION_RING_BUFFER_SIZE } from '../types'

/**
 * Per-source "previous price" state, maintained between ticks.
 * Key is source name, value is the last observed price for that source.
 */
export type SourcePriceState = Record<string, number>

/**
 * Compute a {@link MoveAttribution} record from a new WS price update and the
 * previous per-source price state for this asset pair.
 *
 * @param msg         - The incoming WS price_update message.
 * @param prevSources - Previous per-source prices (mutated in place).
 * @param prevPrice   - Aggregate price from the last tick, or `null` on first tick.
 * @returns A fully populated {@link MoveAttribution} record.
 */
export function computeAttribution(
  msg: WsPriceUpdate,
  prevSources: SourcePriceState,
  prevPrice: number | null,
): MoveAttribution {
  const sourcePrices = msg.sourcePrices ?? {}

  // Build per-source deltas
  const sourceDeltas: SourceDelta[] = msg.sources.map((src) => {
    // Use server-provided per-source price when available, otherwise fall back
    // to the aggregate — this gives a useful approximation while per-source
    // prices are not yet in the server protocol.
    const price = sourcePrices[src] ?? msg.price
    const prev = prevSources[src] ?? null

    const delta = prev !== null ? price - prev : null
    const deltaPercent =
      prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null

    // Update state for next tick
    prevSources[src] = price

    return { source: src, price, prevPrice: prev, delta, deltaPercent }
  })

  // Aggregate delta
  const aggregateDelta = prevPrice !== null ? msg.price - prevPrice : null
  const aggregateDeltaPercent =
    prevPrice !== null && prevPrice !== 0
      ? ((msg.price - prevPrice) / prevPrice) * 100
      : null

  // Identify which source(s) moved the most (largest |delta|)
  const leadingSources = identifyLeaders(sourceDeltas)

  return {
    assetPair: msg.assetPair,
    timestamp: msg.timestamp,
    price: msg.price,
    delta: aggregateDelta,
    deltaPercent: aggregateDeltaPercent,
    sources: sourceDeltas,
    leadingSources,
  }
}

/**
 * Identify the leading source(s) — those with the largest absolute delta.
 * Returns an empty array when no source has a non-null delta yet.
 */
function identifyLeaders(deltas: SourceDelta[]): string[] {
  const withDelta = deltas.filter((d) => d.delta !== null)
  if (withDelta.length === 0) return []

  const maxAbs = Math.max(...withDelta.map((d) => Math.abs(d.delta!)))
  if (maxAbs === 0) return []

  return withDelta
    .filter((d) => Math.abs(d.delta!) === maxAbs)
    .map((d) => d.source)
}

/**
 * Append a new attribution record to a ring-buffer, evicting the oldest entry
 * when the buffer is already at capacity.
 *
 * Designed to be used with React's immutable state updates — returns a **new
 * array** (does not mutate the input).
 *
 * @param buffer  - Current ring-buffer (0 … {@link ATTRIBUTION_RING_BUFFER_SIZE} entries).
 * @param record  - The new attribution record to append.
 * @returns A new array with the record appended and the oldest entry removed
 *          if the buffer was full.
 */
export function appendToRingBuffer(
  buffer: MoveAttribution[],
  record: MoveAttribution,
): MoveAttribution[] {
  if (buffer.length < ATTRIBUTION_RING_BUFFER_SIZE) {
    return [...buffer, record]
  }
  // Evict oldest (index 0) and append new at end
  return [...buffer.slice(1), record]
}
