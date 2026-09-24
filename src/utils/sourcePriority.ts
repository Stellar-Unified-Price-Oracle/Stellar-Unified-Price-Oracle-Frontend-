/**
 * Picks which oracle source should be treated as "active" for a price feed,
 * given a user-configurable priority order.
 *
 * Falls back down the priority list to the next source that is actually
 * present in `sources`, so a card automatically shows the highest-priority
 * source that is currently contributing instead of one that has dropped out.
 */
export function getActiveSource(sources: readonly string[], priority: readonly string[]): string | null {
  for (const candidate of priority) {
    if (sources.includes(candidate)) return candidate
  }
  return sources[0] ?? null
}
