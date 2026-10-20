import type { PriceResyncProgress } from '../types/realtime'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useOutboundQueue } from '../hooks/useOutboundQueue'
import { resolveBackgroundSyncState } from '../realtime/backgroundSyncStatus'

function pendingMessage(isOnline: boolean, blocked: boolean): string {
  if (!isOnline) {
    return 'Background price sync is pending until the connection returns. Last available prices remain displayed.'
  }
  if (blocked) {
    return 'Background price sync is paused by the server and will resume automatically. Last available prices remain displayed.'
  }
  return 'Background price sync is waiting for queued requests to clear. Last available prices remain displayed.'
}

/**
 * Reports the last resync run and, when no run has completed and the sync cannot
 * run yet, that background sync is pending or paused (#830).
 */
export function PriceResyncStatus({ progress }: { progress: PriceResyncProgress | null | undefined }) {
  const { isOnline } = useNetworkStatus()
  const { queued, blocked } = useOutboundQueue()
  const state = resolveBackgroundSyncState({ progress, isOnline, queued, blocked })

  if (state === 'idle') return null

  let message: string
  if (state === 'pending') {
    message = pendingMessage(isOnline, blocked)
  } else if (!progress) {
    return null
  } else if (progress.status === 'syncing') {
    message = `Resynchronizing live prices: ${progress.completed} of ${progress.total} checked.`
  } else if (progress.status === 'complete' && progress.total === 0) {
    message = 'No tracked prices are available to resynchronize.'
  } else if (progress.status === 'complete') {
    message = `Live price resynchronization complete: ${progress.total} prices refreshed.`
  } else if (progress.status === 'failed') {
    message = `Live price resynchronization unavailable: all ${progress.total} refreshes failed. Last available prices remain displayed.`
  } else {
    message = `Live price resynchronization partially complete: ${progress.total - progress.failed} refreshed; ${progress.failed} unavailable. Last available prices remain displayed.`
  }

  return (
    <p
      className={`text-xs ${
        state === 'pending' || state === 'partial' || state === 'failed' ? 'text-amber-300' : 'text-gray-400'
      }`}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  )
}
