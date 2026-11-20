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
import { WS_PROTOCOL_VERSION } from '../api/version'
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
        announcement =
          retryAfterMs && retryAfterMs > 0
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
  const hasProtocolMismatch = diagnostics?.protocolUpgradeRequired === true

  let label = hasProtocolMismatch
    ? 'Update client'
    : isRateLimited
      ? retryAfterMs && retryAfterMs > 0
        ? t('connection.rateLimitedWithTimer', { seconds: Math.ceil(retryAfterMs / 1000) })
        : t('connection.rateLimited')
      : s.label

  // Show retry count on waiting/reconnecting states
  if (
    !isRateLimited &&
    diagnostics &&
    diagnostics.retryCount > 0 &&
    (status === 'waiting' || status === 'reconnecting')
  ) {
    label = `${s.label} (${diagnostics.retryCount}/${20})`
  }

  // #471 – visible indicator when the client has fallen back from WebSocket to SSE.
  const activeTransport = diagnostics?.transport ?? 'ws'
  const isSseFallback = activeTransport === 'sse'
  const readablePath = diagnostics?.transportPath?.map(transport => transport.toUpperCase()).join(' → ')
  const fallbackLabel = diagnostics?.fallbackReason === 'websocket-retries-exhausted' ? 'WebSocket retries exhausted' : ''

  let tooltipText = isRateLimited
    ? 'The API is temporarily rate limited. Requests will resume after the retry window expires.'
    : s.tooltip

  if (hasProtocolMismatch) {
    tooltipText =
      `The server uses WebSocket protocol v${diagnostics?.protocolVersion ?? 'unknown'}, while this frontend supports ` +
      `v${WS_PROTOCOL_VERSION}. Update the frontend to a compatible release and reload. Price polling over REST remains available.`
  }

  if (!isRateLimited && diagnostics && diagnostics.retryCount > 0) {
    tooltipText += ` (attempt ${diagnostics.retryCount} of 20)`
  }

  if (isSseFallback) {
    tooltipText += ' Falling back to Server-Sent Events — the WebSocket upgrade failed or was blocked by the network.'
  }

  const cause = diagnostics?.lastReconnectCause
  const causeLabel =
    cause?.type === 'server' ? 'server response' : cause?.type === 'unknown' ? 'unknown cause' : cause?.type
  const causeDetail = cause
    ? `Last reconnect cause: ${causeLabel}${cause.closeCode ? ` (close code ${cause.closeCode})` : ''}${cause.closeReason ? ` — ${cause.closeReason}` : ''}.`
    : ''
  if (causeDetail) tooltipText += ` ${causeDetail}`

  const counts = diagnostics?.reconnectCauseCounts
  const causeCountsLabel = counts
    ? `Reconnect causes: network ${counts.network}, browser ${counts.browser}, server response ${counts.server}${counts.unknown ? `, unknown ${counts.unknown}` : ''}.`
    : ''
  const ariaLabel = isRateLimited
    ? 'API rate limited'
    : [
        `${isSseFallback ? 'SSE' : 'WebSocket'} ${s.label}`,
        fallbackLabel,
        hasProtocolMismatch ? `Server v${diagnostics?.protocolVersion ?? 'unknown'}, client v${WS_PROTOCOL_VERSION}` : '',
        causeDetail.replace(/\.$/, ''),
        causeCountsLabel.replace(/\.$/, ''),
      ]
        .filter(Boolean)
        .join('. ')
  const hasReconnectCauses = counts && counts.network + counts.browser + counts.server + counts.unknown > 0

  return (
    <Tooltip content={tooltipText}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${hasProtocolMismatch ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
        role="status"
        aria-label={ariaLabel}
      >
        <span
          className={`w-2 h-2 rounded-full ${hasProtocolMismatch ? 'bg-amber-500' : isRateLimited ? 'bg-orange-500' : s.color} ${status === 'connected' && !isRateLimited && !hasProtocolMismatch ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
        {label}
        {hasReconnectCauses && (
          <span className="ml-1 border-l border-current/20 pl-2 text-[10px] font-normal opacity-80">
            Network {counts.network} · Browser {counts.browser} · Server response {counts.server}
          </span>
        )}
        {isSseFallback && (
          <span
            className="px-1 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wide"
            title="Streaming over Server-Sent Events (WebSocket fallback)"
          >
            SSE
          </span>
        )}
        {fallbackLabel && <span>{fallbackLabel}</span>}
        {readablePath && (
          <span
            className="border-l border-gray-600 pl-1.5 text-[10px] text-gray-400"
            title={`Active transport: ${activeTransport === 'sse' ? 'Server-Sent Events' : 'WebSocket'}; path: ${readablePath}`}
          >
            {readablePath}
          </span>
        )}
      </span>
    </Tooltip>
  )
})
