import type { PriceResyncProgress } from '../types/realtime'

/**
 * What the user should be told about background price synchronization (#830).
 *
 * - `pending`: no sync has completed yet and the sync cannot run right now
 *   (offline, server-directed backoff, or requests queued behind the limiter).
 * - `syncing`, `complete`, `partial`, `failed`: mirror the last resync run.
 * - `idle`: nothing to report (online, nothing queued, no run yet).
 */
export type BackgroundSyncState = 'idle' | 'pending' | 'syncing' | 'complete' | 'partial' | 'failed'

export interface BackgroundSyncInput {
  progress: PriceResyncProgress | null | undefined
  isOnline: boolean
  queued: number
  blocked: boolean
}

export function resolveBackgroundSyncState({
  progress,
  isOnline,
  queued,
  blocked,
}: BackgroundSyncInput): BackgroundSyncState {
  const status = progress?.status
  if (status === 'syncing' || status === 'partial' || status === 'failed') return status
  // A completed run is final until the next one starts, even if the network drops afterwards.
  if (status === 'complete') return 'complete'
  return isOnline && !blocked && queued === 0 ? 'idle' : 'pending'
}
