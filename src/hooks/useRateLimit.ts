/**
 * Hook for tracking and displaying API rate limit information.
 * Parses X-RateLimit-* headers from API responses.
 * Issue #93
 */

import { useState, useCallback } from 'react'
import type { RateLimitInfo } from '../types'

export function useRateLimit() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null)

  /**
   * Parse rate limit headers from a fetch response
   */
  const parseRateLimitHeaders = useCallback((response: Response): void => {
    try {
      const limit = response.headers.get('x-ratelimit-limit')
      const remaining = response.headers.get('x-ratelimit-remaining')
      const reset = response.headers.get('x-ratelimit-reset')

      if (limit && remaining && reset) {
        setRateLimitInfo({
          limit: parseInt(limit, 10),
          remaining: parseInt(remaining, 10),
          reset: parseInt(reset, 10),
        })
      }
    } catch (e) {
      console.debug('Failed to parse rate limit headers:', e)
    }
  }, [])

  /**
   * Calculate remaining percentage (0-100)
   */
  const getRemainingPercentage = useCallback((): number => {
    if (!rateLimitInfo) return 100
    return Math.round((rateLimitInfo.remaining / rateLimitInfo.limit) * 100)
  }, [rateLimitInfo])

  /**
   * Check if approaching limit (< 10% remaining)
   */
  const isApproachingLimit = useCallback((): boolean => {
    return getRemainingPercentage() < 10
  }, [getRemainingPercentage])

  /**
   * Get status color based on remaining percentage
   */
  const getStatusColor = useCallback((): string => {
    const percentage = getRemainingPercentage()
    if (percentage >= 50) return 'green' // Healthy
    if (percentage >= 10) return 'yellow' // Warning
    return 'red' // Critical
  }, [getRemainingPercentage])

  /**
   * Get time until reset as formatted string
   */
  const getResetCountdown = useCallback((): string => {
    if (!rateLimitInfo) return ''

    const now = Math.floor(Date.now() / 1000)
    const secondsUntilReset = rateLimitInfo.reset - now

    if (secondsUntilReset <= 0) {
      return 'Resets now'
    }

    if (secondsUntilReset < 60) {
      return `${secondsUntilReset}s`
    }

    const minutes = Math.floor(secondsUntilReset / 60)
    return `${minutes}m`
  }, [rateLimitInfo])

  return {
    rateLimitInfo,
    parseRateLimitHeaders,
    getRemainingPercentage,
    isApproachingLimit,
    getStatusColor,
    getResetCountdown,
  }
}
