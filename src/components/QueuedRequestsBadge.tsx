/**
 * @file QueuedRequestsBadge
 *
 * Visual indicator for client-side outbound back-pressure (issue #330).
 *
 * Renders nothing in the common case. It appears only when requests are being
 * held back — either queued behind a token bucket, or paused because the server
 * returned `Retry-After`.
 *
 * @example
 * ```tsx
 * <QueuedRequestsBadge />
 * ```
 *
 * ## States
 * | condition            | colour | label                |
 * |----------------------|--------|----------------------|
 * | server backoff       | orange | `Paused (Ns)`        |
 * | requests queued      | amber  | `Queued (N)`         |
 * | neither              | —      | renders `null`       |
 *
 * ## Accessibility
 * - `role="status"` with `aria-live="polite"` so the queue depth is announced
 *   without stealing focus.
 * - The dot is `aria-hidden`; meaning is carried by the text label.
 */
import { memo, type ReactElement } from 'react'
import { useOutboundQueue } from '../hooks/useOutboundQueue'

export const QueuedRequestsBadge = memo(function QueuedRequestsBadge(): ReactElement | null {
  const { queued, blocked, retryAfterSec } = useOutboundQueue()

  if (!blocked && queued === 0) return null

  const label = blocked
    ? retryAfterSec > 0
      ? `Paused (${retryAfterSec}s)`
      : 'Paused'
    : `Queued (${queued})`

  const description = blocked
    ? 'The server asked the app to slow down. Requests resume automatically.'
    : `${queued} request${queued === 1 ? '' : 's'} waiting for the rate-limit window to open.`

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
      role="status"
      aria-live="polite"
      aria-label={description}
      title={description}
    >
      <span
        className={`w-2 h-2 rounded-full ${blocked ? 'bg-orange-500' : 'bg-amber-400 animate-pulse'}`}
        aria-hidden="true"
      />
      {label}
    </span>
  )
})
