import { useNetworkStatus } from '../hooks/useNetworkStatus'

export function NetworkStatusBanner() {
  const isOnline = useNetworkStatus()

  if (isOnline) return null

  return (
    <div className="fixed bottom-4 right-4 z-50" role="alert">
      <div className="bg-yellow-50 dark:bg-yellow-900/90 border border-yellow-200 dark:border-yellow-700/50 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg shadow-black/10 dark:shadow-black/30 flex items-center gap-3">
        <svg className="w-5 h-5 text-yellow-500 dark:text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">No internet connection</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-500">Data may be stale until you reconnect</p>
        </div>
      </div>
    </div>
  )
}
