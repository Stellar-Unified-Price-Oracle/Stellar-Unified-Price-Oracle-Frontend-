/**
 * @file AlertBadge
 *
 * A compact pill button that summarises how many active price alerts exist for
 * an asset pair and shows a directional indicator (↑ upper, ↓ lower, ↕ both).
 *
 * Returns `null` when `count` is zero so callers do not need an outer `{count > 0 && ...}` guard.
 *
 * @example With upper and lower thresholds
 * ```tsx
 * <AlertBadge count={2} alerts={activeAlerts} onClick={openPanel} />
 * ```
 *
 * @example Inside a price card header
 * ```tsx
 * {hasAlert && (
 *   <AlertBadge
 *     count={alertCount}
 *     alerts={alertsForPair}
 *     onClick={toggleAlertPanel}
 *   />
 * )}
 * ```
 *
 * ## Props table
 * | prop      | type         | required | description                                              |
 * |-----------|--------------|----------|----------------------------------------------------------|
 * | `count`   | `number`     | yes      | Total active alert count; component renders null when 0  |
 * | `alerts`  | `Alert[]`    | yes      | Alert objects used to derive the directional indicator   |
 * | `onClick` | `() => void` | no       | Callback when the badge is clicked                       |
 *
 * ## Edge cases
 * - **count = 0** — component renders `null`; no DOM node is produced.
 * - **Threshold combination** — `↑` when only upper thresholds exist, `↓` when only
 *   lower, `↕` when both are present across the alert set.
 * - **count > 1** — label pluralises to "N alerts".
 *
 * ## Accessibility
 * - Rendered as a `<button>` with a descriptive `aria-label` (e.g. "2 active alerts").
 * - The directional arrow character is `aria-hidden`-free (part of the visible label)
 *   but the `aria-label` conveys full intent independently of it.
 */
import { memo, type ReactElement } from 'react'
import type { Alert } from '../types'

interface AlertBadgeProps {
  count: number
  alerts: Alert[]
  onClick?: () => void
}

export const AlertBadge = memo(function AlertBadge({ count, alerts, onClick }: AlertBadgeProps): ReactElement | null {
  if (count === 0) return null

  const hasUpper = alerts.some((a) => a.upperThreshold !== null)
  const hasLower = alerts.some((a) => a.lowerThreshold !== null)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full hover:bg-amber-400/20 transition-colors"
      aria-label={`${count} active alert${count > 1 ? 's' : ''}`}
      type="button"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
        />
      </svg>
      <span>
        {count} alert{count > 1 ? 's' : ''}
      </span>
      {hasUpper && hasLower ? (
        <span className="text-amber-500">&#8597;</span>
      ) : hasUpper ? (
        <span className="text-amber-500">&uarr;</span>
      ) : (
        <span className="text-amber-500">&darr;</span>
      )}
    </button>
  )
})
