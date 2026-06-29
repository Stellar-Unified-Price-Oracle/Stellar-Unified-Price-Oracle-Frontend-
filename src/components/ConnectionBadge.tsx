import { type ReactElement } from 'react'
import type { RateLimitStatus } from '../api/rateLimit'
import type { ConnectionStatus } from '../api/websocket'
import { Tooltip } from './Tooltip'

const STATUS_MAP: Record<ConnectionStatus, { label: string; color: string; tooltip: string }> = {
  connected: { label: 'Live', color: 'bg-green-500', tooltip: 'WebSocket is connected. Price updates are streaming in real time.' },
  connecting: { label: 'Connecting', color: 'bg-yellow-500', tooltip: 'Establishing a WebSocket connection to the price feed server.' },
  reconnecting: { label: 'Reconnecting', color: 'bg-yellow-500', tooltip: 'The WebSocket connection was lost. Attempting to reconnect automatically.' },
  disconnected: { label: 'Offline', color: 'bg-red-500', tooltip: 'WebSocket is offline. Prices are updated via REST polling only.' },
}

interface ConnectionBadgeProps {
  status: ConnectionStatus
  rateLimitStatus?: RateLimitStatus
  retryAfterMs?: number
}

export function ConnectionBadge({ status, rateLimitStatus, retryAfterMs }: ConnectionBadgeProps): ReactElement {
  const s = STATUS_MAP[status]
  const isRateLimited = rateLimitStatus === 'limited'
  const label = isRateLimited
    ? retryAfterMs && retryAfterMs > 0
      ? `Rate limited (${Math.ceil(retryAfterMs / 1000)}s)`
      : 'Rate limited'
    : s.label
  const ariaLabel = isRateLimited ? 'API rate limited' : `WebSocket ${s.label}`

  return (
    <Tooltip content={isRateLimited ? 'The API is temporarily rate limited. Requests will resume after the retry window expires.' : s.tooltip}>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" role="status" aria-label={ariaLabel}>
        <span className={`w-2 h-2 rounded-full ${isRateLimited ? 'bg-orange-500' : s.color} ${status === 'connected' && !isRateLimited ? 'animate-pulse' : ''}`} aria-hidden="true" />
        {label}
      </span>
    </Tooltip>
  )
}
