/**
 * Analytics consent banner component.
 * Shows opt-in prompt for anonymous usage statistics collection.
 * Issue #90
 */

import { memo } from 'react'
import { useAnalytics } from '../context/AnalyticsContext'

export const AnalyticsConsentBanner = memo(function AnalyticsConsentBanner() {
  const { showConsentPrompt, requestConsent } = useAnalytics()

  if (!showConsentPrompt) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-40">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            We collect anonymous usage statistics to improve the app. No personal information is
            collected or shared.
            <a
              href="#privacy"
              className="ml-2 text-blue-600 dark:text-blue-400 underline hover:no-underline"
            >
              Learn more
            </a>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={requestConsent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md font-medium text-sm transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
})
