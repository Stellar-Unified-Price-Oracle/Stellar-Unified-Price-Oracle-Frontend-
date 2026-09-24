/**
 * useApiVersion
 *
 * React hook that subscribes to the global API version detection state.
 * Returns the current {@link ApiVersionInfo} once detection has completed,
 * or `null` while the initial check is in flight.
 *
 * Also exports `useInitApiVersion()` which runs `initApiVersionDetection()`
 * on mount — call this once at the App root.
 */

import { useState, useEffect } from 'react'
import {
  subscribeApiVersion,
  initApiVersionDetection,
  type ApiVersionInfo,
} from '../api/version'

/**
 * Returns the current API version info, or `null` during the initial detection.
 */
export function useApiVersion(): ApiVersionInfo | null {
  const [info, setInfo] = useState<ApiVersionInfo | null>(null)

  useEffect(() => {
    return subscribeApiVersion(setInfo)
  }, [])

  return info
}

/**
 * Runs API version detection on mount. Mount this once at the App root
 * (alongside useWebVitals, initAnalytics, etc.).
 *
 * Returns the detected version info, or null while detection is pending.
 */
export function useInitApiVersion(): ApiVersionInfo | null {
  const [info, setInfo] = useState<ApiVersionInfo | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    initApiVersionDetection(controller.signal).then((detected) => {
      if (!controller.signal.aborted) setInfo(detected)
    }).catch(() => {
      // detection errors are handled inside initApiVersionDetection
    })

    const unsubscribe = subscribeApiVersion(setInfo)

    return () => {
      controller.abort()
      unsubscribe()
    }
  }, [])

  return info
}
