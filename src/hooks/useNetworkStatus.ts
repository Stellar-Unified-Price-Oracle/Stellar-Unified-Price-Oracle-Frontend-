import { useState, useEffect, useCallback } from 'react'

export interface UseNetworkStatusResult {
  /** Whether the browser currently has a network connection */
  isOnline: boolean
  /** Timestamp of the last status change, or null if no change has occurred */
  lastChanged: number | null
}

/**
 * Tracks the browser's online/offline status via `navigator.onLine` and the
 * `online`/`offline` window events.
 *
 * Returns `isOnline` and a `lastChanged` timestamp so consumers can react to
 * connectivity transitions.
 */
export function useNetworkStatus(): UseNetworkStatusResult {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  )
  const [lastChanged, setLastChanged] = useState<number | null>(null)

  const goOnline = useCallback(() => {
    setIsOnline(true)
    setLastChanged(Date.now())
  }, [])

  const goOffline = useCallback(() => {
    setIsOnline(false)
    setLastChanged(Date.now())
  }, [])

  useEffect(() => {
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [goOnline, goOffline])

  return { isOnline, lastChanged }
}
