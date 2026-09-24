/**
 * @file FreshnessBadge
 *
 * Colour-coded indicator of how old a price update is: green when the price
 * is under 30s old, yellow when under 2 minutes, red beyond that. Ticks once
 * a second so the label and colour stay accurate without a re-render from
 * the parent. The tooltip shows the precise timestamp and a countdown to the
 * next scheduled refresh.
 *
 * @example
 * ```tsx
 * <FreshnessBadge timestamp={price.timestamp} refreshIntervalMs={preferences.refreshInterval} />
 * ```
 */
import { memo, useEffect, useState } from 'react'
import { formatTimestamp, timeAgo } from '../utils/format'
import { Tooltip } from './Tooltip'

const FRESH_THRESHOLD_MS = 30_000
const AGING_THRESHOLD_MS = 120_000
const TICK_MS = 1000

interface FreshnessBadgeProps {
  /** Unix timestamp in ms when this price was last updated. */
  timestamp: number
  /** Configured polling interval, used to estimate the next refresh. */
  refreshIntervalMs: number
}

export const FreshnessBadge = memo(function FreshnessBadge({ timestamp, refreshIntervalMs }: FreshnessBadgeProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const age = now - timestamp
  const color =
    age < FRESH_THRESHOLD_MS ? 'bg-green-500' : age < AGING_THRESHOLD_MS ? 'bg-yellow-500' : 'bg-red-500'
  const nextRefreshInSec = Math.max(0, Math.ceil((timestamp + refreshIntervalMs - now) / 1000))

  return (
    <Tooltip content={`Updated ${formatTimestamp(timestamp)} · next refresh in ~${nextRefreshInSec}s`}>
      <span
        className="inline-flex items-center gap-1.5"
        role="status"
        aria-label={`Data freshness: updated ${timeAgo(timestamp)}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} aria-hidden="true" />
        {timeAgo(timestamp)}
      </span>
    </Tooltip>
  )
})
