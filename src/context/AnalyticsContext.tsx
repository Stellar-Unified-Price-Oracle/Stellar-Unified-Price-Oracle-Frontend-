/**
 * React context for analytics consent and event tracking.
 * Issue #90
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AnalyticsCollector } from '../utils/analytics'
import type { AnalyticsEventType } from '../types'

interface AnalyticsContextType {
  hasConsent: boolean
  requestConsent: () => void
  revokeConsent: () => void
  track: (type: AnalyticsEventType, payload?: Record<string, unknown>) => void
  showConsentPrompt: boolean
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({
  children,
  endpoint,
}: {
  children: ReactNode
  endpoint: string
}) {
  const [hasConsent, setHasConsent] = useState(() => AnalyticsCollector.hasConsent())
  const [showConsentPrompt, setShowConsentPrompt] = useState(() => {
    // Show prompt only if no consent is given and endpoint is configured
    return !AnalyticsCollector.hasConsent() && !!endpoint
  })

  const handleRequestConsent = useCallback(() => {
    const consentGiven = AnalyticsCollector.requestConsent()
    setHasConsent(consentGiven)
    if (consentGiven) {
      setShowConsentPrompt(false)
    }
  }, [])

  const handleRevokeConsent = useCallback(() => {
    AnalyticsCollector.revokeConsent()
    setHasConsent(false)
  }, [])

  const handleTrack = useCallback(
    (type: AnalyticsEventType, payload?: Record<string, unknown>) => {
      AnalyticsCollector.track(type, payload)
    },
    []
  )

  return (
    <AnalyticsContext.Provider
      value={{
        hasConsent,
        requestConsent: handleRequestConsent,
        revokeConsent: handleRevokeConsent,
        track: handleTrack,
        showConsentPrompt,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics(): AnalyticsContextType {
  const context = useContext(AnalyticsContext)
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider')
  }
  return context
}
