/**
 * @file StaleDataWarningBanner
 *
 * Warns the user when at least one visible price feed hasn't updated within
 * the configured staleness threshold (`preferences.staleThresholdMinutes`).
 */
import { memo } from 'react'

interface StaleDataWarningBannerProps {
  thresholdMinutes: number
}

export const StaleDataWarningBanner = memo(function StaleDataWarningBanner({
  thresholdMinutes,
}: StaleDataWarningBannerProps) {
  return (
    <div
      className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-400"
      role="alert"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        Some price data hasn&apos;t updated in over {thresholdMinutes} minute{thresholdMinutes === 1 ? '' : 's'} and
        may be stale.
      </span>
    </div>
  )
})
