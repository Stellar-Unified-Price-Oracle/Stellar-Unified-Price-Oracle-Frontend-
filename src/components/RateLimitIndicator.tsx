/**
 * Rate limit indicator component for the UI.
 * Shows current rate limit status in the connection badge or footer.
 * Issue #93
 */

import { memo, useEffect, useState } from 'react'
import { useRateLimit } from '../hooks/useRateLimit'
import { getRateLimitInfo } from '../api/rest'

export const RateLimitIndicator = memo(function RateLimitIndicator() {
  const { getStatusColor, getResetCountdown } = useRateLimit()
  const [rateLimitInfo, setRateLimitInfo] = useState(getRateLimitInfo())

  // Update local state when rate limit changes
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitInfo(getRateLimitInfo())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!rateLimitInfo) return null

  const remaining = rateLimitInfo.remaining
  const limit = rateLimitInfo.limit
  const percentage = Math.round((remaining / limit) * 100)
  const statusColor = getStatusColor()
  const countdown = getResetCountdown()
  const isWarning = percentage < 10

  const colorClass =
    statusColor === 'green'
      ? 'text-green-600 dark:text-green-400'
      : statusColor === 'yellow'
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400'

  const bgColorClass =
    statusColor === 'green'
      ? 'bg-green-100 dark:bg-green-900'
      : statusColor === 'yellow'
        ? 'bg-yellow-100 dark:bg-yellow-900'
        : 'bg-red-100 dark:bg-red-900'

  return (
    <div className={`px-3 py-2 rounded-md ${bgColorClass} ${colorClass} text-sm`}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="font-semibold">Rate Limit</div>
          <div className="text-xs opacity-75">
            {remaining}/{limit} ({percentage}%)
          </div>
        </div>
        {isWarning && (
          <div className="text-xs font-bold">
            ⚠️ {countdown}
          </div>
        )}
      </div>
      <div className="mt-1 w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            statusColor === 'green'
              ? 'bg-green-600'
              : statusColor === 'yellow'
                ? 'bg-yellow-600'
                : 'bg-red-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
})
