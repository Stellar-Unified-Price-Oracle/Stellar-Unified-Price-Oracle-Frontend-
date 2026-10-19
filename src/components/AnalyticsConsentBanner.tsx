import { useState, type ReactElement } from 'react'
import {
  useAnalyticsConsent,
  ANALYTICS_CATEGORIES,
  type AnalyticsCategory,
} from '../utils/analyticsConsent'

export function AnalyticsConsentBanner(): ReactElement | null {
  const { consent, dntActive, acceptAll, declineAll, updateCategory, setMaster } = useAnalyticsConsent()
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [customDraft, setCustomDraft] = useState<Record<AnalyticsCategory, boolean>>(() => ({
    ...consent.categories,
  }))

  // Never display banner if user has already made an explicit choice or if browser enforces DNT
  if (consent.hasExplicitChoice || dntActive) {
    return null
  }

  const handleAcceptAll = () => {
    acceptAll()
  }

  const handleDeclineAll = () => {
    declineAll()
  }

  const handleToggleDraftCategory = (cat: AnalyticsCategory) => {
    setCustomDraft((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }))
  }

  const handleSaveCustom = () => {
    const hasAnyActive = Object.values(customDraft).some(Boolean)
    setMaster(hasAnyActive)
    for (const [cat, enabled] of Object.entries(customDraft)) {
      updateCategory(cat as AnalyticsCategory, enabled)
    }
    setIsCustomizing(false)
  }

  return (
    <aside
      role="region"
      aria-label="Analytics & Privacy Choices"
      aria-live="polite"
      className="fixed bottom-4 start-4 end-4 md:start-auto md:end-6 md:max-w-xl z-50 p-4 md:p-5 rounded-xl bg-gray-900/95 border border-cyan-500/30 backdrop-blur-md shadow-2xl text-gray-200 animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Privacy & Analytics Preferences</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              We collect privacy-preserving telemetry without third-party cookies, IP logging, or wallet tracking.
            </p>
          </div>
        </div>
      </div>

      {!isCustomizing ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={handleDeclineAll}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
          >
            Decline All
          </button>
          <button
            type="button"
            onClick={() => setIsCustomizing(true)}
            className="text-xs px-3 py-1.5 rounded-lg hover:bg-gray-800 text-cyan-400 hover:text-cyan-300 font-medium underline transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            Customize Categories
          </button>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
          <p className="text-xs text-gray-300 font-medium">Granular Category Controls:</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
            {ANALYTICS_CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-800/60 border border-gray-750 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={customDraft[cat.id]}
                  onChange={() => handleToggleDraftCategory(cat.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-600 text-cyan-600 focus:ring-cyan-500 bg-gray-900"
                  aria-label={cat.name}
                />
                <div>
                  <span className="text-xs font-medium text-gray-200 block">{cat.name}</span>
                  <span className="text-[11px] text-gray-400 block mt-0.5">{cat.description}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setIsCustomizing(false)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustom}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
