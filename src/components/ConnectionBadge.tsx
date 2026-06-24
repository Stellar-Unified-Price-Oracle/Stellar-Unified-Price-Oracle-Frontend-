import type { ConnectionStatus } from '../api/websocket'

const STATUS_MAP: Record<ConnectionStatus, { label: string; color: string }> = {
  connected: { label: 'Live', color: 'bg-green-500' },
  connecting: { label: 'Connecting', color: 'bg-yellow-500' },
  reconnecting: { label: 'Reconnecting', color: 'bg-yellow-500' },
  disconnected: { label: 'Offline', color: 'bg-red-500' },
}

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const s = STATUS_MAP[status]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" role="status" aria-label={`WebSocket ${s.label}`}>
      <span className={`w-2 h-2 rounded-full ${s.color} ${status === 'connected' ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}
