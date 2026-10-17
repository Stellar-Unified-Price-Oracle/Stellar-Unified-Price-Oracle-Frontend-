import { memo } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

interface OfflineUnavailableNoticeProps {
  onRetry: () => void
}

/**
 * Shown when the browser is offline and there is neither a live price feed nor
 * a cached snapshot to fall back to (#827). Distinct from `OfflineSnapshotBanner`,
 * which covers the stale-but-available case. Renders nothing while online, since
 * an online empty state is an error or loading state handled elsewhere.
 */
export const OfflineUnavailableNotice = memo(function OfflineUnavailableNotice({
  onRetry,
}: OfflineUnavailableNoticeProps) {
  const { isOnline } = useNetworkStatus()
  if (isOnline) return null

  return (
    <section
      className="mb-4 p-4 bg-gray-900/60 border border-gray-700 rounded-xl flex flex-wrap items-center gap-3 text-sm text-gray-200"
      aria-label="Prices unavailable offline"
      role="alert"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">No prices available offline</p>
        <p className="text-xs text-gray-400">
          Your browser is offline and no cached prices are saved on this device. Prices will load automatically when the
          connection returns.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-white"
        aria-label="Retry loading prices"
      >
        Retry
      </button>
    </section>
  )
})
