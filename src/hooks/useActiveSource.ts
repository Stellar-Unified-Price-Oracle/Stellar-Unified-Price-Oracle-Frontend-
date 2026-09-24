import { useEffect, useRef } from 'react'
import { getActiveSource } from '../utils/sourcePriority'

/**
 * Resolves the active oracle source for a price feed from the configured
 * priority order, and logs a debug message whenever the active source
 * changes (e.g. a higher-priority source drops out and the feed falls back
 * to the next one), so source switches can be traced during debugging.
 */
export function useActiveSource(assetPair: string, sources: readonly string[], priority: readonly string[]): string | null {
  const active = getActiveSource(sources, priority)
  const prevRef = useRef<string | null>(active)

  useEffect(() => {
    if (prevRef.current !== active) {
      console.debug(`[oracle] ${assetPair} active source changed: ${prevRef.current ?? 'none'} -> ${active ?? 'none'}`)
      prevRef.current = active
    }
  }, [assetPair, active])

  return active
}
