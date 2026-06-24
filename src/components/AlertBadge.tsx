import type { Alert } from '../types'

interface AlertBadgeProps {
  count: number
  alerts: Alert[]
  onClick?: () => void
}

export function AlertBadge({ count, alerts, onClick }: AlertBadgeProps) {
  if (count === 0) return null

  const hasUpper = alerts.some((a) => a.upperThreshold !== null)
  const hasLower = alerts.some((a) => a.lowerThreshold !== null)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full hover:bg-amber-400/20 transition-colors"
      aria-label={`${count} active alert${count > 1 ? 's' : ''}`}
      type="button"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
        />
      </svg>
      <span>
        {count} alert{count > 1 ? 's' : ''}
      </span>
      {hasUpper && hasLower ? (
        <span className="text-amber-500">&#8597;</span>
      ) : hasUpper ? (
        <span className="text-amber-500">&uarr;</span>
      ) : (
        <span className="text-amber-500">&darr;</span>
      )}
    </button>
  )
}
