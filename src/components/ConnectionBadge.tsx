/**
 * @file ConnectionBadge
 *
 * Displays the current WebSocket connection status as a pill badge with an
 * animated colour indicator.
 *
 * @example Minimal — connected
 * ```tsx
 * <ConnectionBadge status="connected" />
 * ```
 *
 * @example With retry diagnostics
 * ```tsx
 * <ConnectionBadge
 *   status="reconnecting"
 *   diagnostics={ws.diagnostics}
 * />
 * ```
 *
 * @example Rate-limited state with countdown
 * ```tsx
 * <ConnectionBadge
 *   status="connected"
 *   rateLimitStatus="limited"
 *   retryAfterMs={4500}
 * />
 * ```
 *
 * ## Status states
 * | status        | colour | meaning                                          |
 * |---------------|--------|--------------------------------------------------|
 * | `connected`   | green  | WebSocket open, prices streaming in real time    |
 * | `connecting`  | yellow | Initial handshake in progress                    |
 * | `reconnecting`| yellow | Connection lost, auto-retry in progress          |
 * | `waiting`     | orange | Exponential back-off window before next attempt  |
 * | `dead`        | red    | Max retries exhausted, manual reload required    |
 * | `disconnected`| red    | Offline, REST polling only                       |
 * | `paused`      | orange | Inbound updates paused under backpressure (#469) |
 *
 * ## Edge cases
 * - **Rate limited** — overrides the status colour with orange and shows a countdown
 *   timer (e.g. "Rate limited (5 s)") when `retryAfterMs` is provided.
 * - **Diagnostics** — when `diagnostics.retryCount > 0` and status is `reconnecting`
 *   or `waiting`, the label includes `(attempt N/20)`.
 * - **Unknown status** — falls back to the `disconnected` entry in `STATUS_MAP`.
 *
 * ## Accessibility
 * - Root `<span>` carries `role="status"` and a descriptive `aria-label`.
 * - The coloured dot has `aria-hidden="true"` — meaning is conveyed by the text label.
 * - A `Tooltip` provides the full explanation for users who want more detail.
 */
import { memo, useEffect, useRef, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { RateLimitStatus } from '../api/rateLimit'
import type { ConnectionStatus, ConnectionDiagnostics } from '../api/websocket'
import { useAnnounce } from '../hooks/useAnnounce'
import { Tooltip } from './Tooltip'

const STATUS_MAP: Record<ConnectionStatus, { label: string; color: string; tooltip: string }> = {
  connected: {
    label: 'Live',
    color: 'bg-green-500',
    tooltip: 'WebSocket is connected. Price updates are streaming in real time.',
  },
  connecting: {
    label: 'Connecting',
    color: 'bg-yellow-500',
    tooltip: 'Establishing a WebSocket connection to the price feed server.',
  },
  reconnecting: {
    label: 'Reconnecting',
    color: 'bg-yellow-500',
    tooltip: 'The WebSocket connection was lost. Attempting to reconnect automatically.',
  },
  waiting: {
    label: 'Waiting',
    color: 'bg-orange-400',
    tooltip: 'In backoff window before next reconnect attempt.',
  },
  dead: {
    label: 'Disconnected',
    color: 'bg-red-600',
    tooltip: 'Maximum reconnect attempts reached. Refresh the page to try again.',
  },
  disconnected: {
    label: 'Offline',
    color: 'bg-red-500',
    tooltip: 'WebSocket is offline. Prices are updated via REST polling only.',
  },
  paused: {
    label: 'Paused',
    color: 'bg-orange-500',
    tooltip:
      'Inbound updates are paused — the client asked the server to pause this subscription ' +
      'while it catches up. Resumes automatically once the backlog drains.',
  },
}

interface ConnectionBadgeProps {
  status: ConnectionStatus
  rateLimitStatus?: RateLimitStatus
  retryAfterMs?: number
  /** Optional diagnostics from {@link WebSocketClient.diagnostics} for richer UI. */
  diagnostics?: ConnectionDiagnostics
}

export const ConnectionBadge = memo(function ConnectionBadge({
  status,
  rateLimitStatus,
  retryAfterMs,
  diagnostics,
}: ConnectionBadgeProps): ReactElement {
  const { t } = useTranslation()
  const { announce } = useAnnounce()
  const prevStatusRef = useRef<ConnectionStatus | 'rate-limited'>(status)
  
  // Announce status changes to screen readers
  useEffect(() => {
    const isRateLimited = rateLimitStatus === 'limited'
    const currentKey = isRateLimited ? 'rate-limited' : status
    
    if (prevStatusRef.current !== currentKey) {
      let announcement = ''
      
      if (isRateLimited) {
        announcement = retryAfterMs && retryAfterMs > 0
          ? `API rate limited, requests will resume in ${Math.ceil(retryAfterMs / 1000)} seconds`
          : 'API rate limited'
      } else {
        const s = STATUS_MAP[status] ?? STATUS_MAP['disconnected']
        announcement = `Connection status: ${s.label}`
        if (diagnostics?.retryCount) {
          announcement += ` (attempt ${diagnostics.retryCount} of 20)`
        }
      }
      
      announce(announcement, isRateLimited || status === 'dead' ? 'assertive' : 'polite')
      prevStatusRef.current = currentKey
    }
  }, [status, rateLimitStatus, retryAfterMs, diagnostics, announce])

  const s = STATUS_MAP[status] ?? STATUS_MAP['disconnected']
  const isRateLimited = rateLimitStatus === 'limited'

  let label = isRateLimited
    ? retryAfterMs && retryAfterMs > 0
      ? t('connection.rateLimitedWithTimer', { seconds: Math.ceil(retryAfterMs / 1000) })
      : t('connection.rateLimited')
    : s.label

  // Show retry count on waiting/reconnecting states
  if (!isRateLimited && diagnostics && diagnostics.retryCount > 0 && (status === 'waiting' || status === 'reconnecting')) {
    label = `${s.label} (${diagnostics.retryCount}/${20})`
  }

  // #471 – visible indicator when the client has fallen back from WebSocket to SSE.
  const isSseFallback = diagnostics?.transport === 'sse'

  const ariaLabel = isRateLimited ? 'API rate limited' : `WebSocket ${s.label}`

  let tooltipText = isRateLimited
    ? 'The API is temporarily rate limited. Requests will resume after the retry window expires.'
    : s.tooltip

  if (!isRateLimited && diagnostics && diagnostics.retryCount > 0) {
    tooltipText += ` (attempt ${diagnostics.retryCount} of 20)`
  }

  if (isSseFallback) {
    tooltipText +=
      ' Falling back to Server-Sent Events — the WebSocket upgrade failed or was blocked by the network.'
  }

  return (
    <Tooltip content={tooltipText}>
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
        role="status"
        aria-label={ariaLabel}
      >
        <span
          className={`w-2 h-2 rounded-full ${isRateLimited ? 'bg-orange-500' : s.color} ${status === 'connected' && !isRateLimited ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
        {label}
        {isSseFallback && (
          <span
            className="px-1 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wide"
            title="Streaming over Server-Sent Events (WebSocket fallback)"
          >
            SSE
          </span>
        )}
      </span>
    </Tooltip>
  )
})
