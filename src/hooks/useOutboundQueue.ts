import { useSyncExternalStore } from 'react'
import { outboundRateLimiter, type OutboundQueueState } from '../api/outboundRateLimiter'

export interface OutboundQueueView extends OutboundQueueState {
  /** Rounded-up seconds remaining on a server-directed block (0 when clear). */
  retryAfterSec: number
  /** `true` when the UI should show a degraded / back-pressured state. */
  degraded: boolean
}

/**
 * Subscribes to the shared outbound rate limiter so components can render
 * back-pressure: how many requests are waiting, and whether the server has
 * asked the client to pause.
 *
 * Uses `useSyncExternalStore`, so the limiter is the single source of truth and
 * no polling interval is needed.
 */
export function useOutboundQueue(): OutboundQueueView {
  const state = useSyncExternalStore(
    (onChange) => outboundRateLimiter.subscribe(onChange),
    () => outboundRateLimiter.getSnapshot(),
    () => outboundRateLimiter.getSnapshot(),
  )

  const remainingMs = state.blocked ? Math.max(0, state.blockedUntil - Date.now()) : 0

  return {
    ...state,
    retryAfterSec: Math.ceil(remainingMs / 1000),
    degraded: state.blocked || state.queued > 0,
  }
}
