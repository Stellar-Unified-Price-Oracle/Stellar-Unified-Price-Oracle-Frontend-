/**
 * ApiVersionBanner
 *
 * Displays a persistent banner when the detected API version is incompatible
 * or when there is a minor mismatch that users should be aware of.
 *
 * - Incompatible: full-width red error banner, not dismissible.
 *   The app enters a degraded state and data fetching may fail.
 * - Minor mismatch: amber warning banner, dismissible per session.
 * - Compatible / unknown: renders nothing.
 */

import { memo, useState, useCallback } from 'react'
import { useApiVersion } from '../hooks/useApiVersion'
import type { VersionCompatibility } from '../api/version'

const DISMISS_STORAGE_KEY = 'api_version_warning_dismissed'

function getDismissedVersion(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY)
  } catch {
    return null
  }
}

function setDismissedVersion(version: string): void {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, version)
  } catch {
    // ignore
  }
}

const bannerStyles: Record<VersionCompatibility, string> = {
  incompatible:
    'border-red-500/50 bg-red-950/80 text-red-200',
  'minor-mismatch':
    'border-amber-500/40 bg-amber-950/70 text-amber-200',
  compatible: '',
  unknown: '',
}

const iconByCompatibility: Record<VersionCompatibility, string> = {
  incompatible: '❌',
  'minor-mismatch': '⚠️',
  compatible: '',
  unknown: '',
}

export const ApiVersionBanner = memo(function ApiVersionBanner() {
  const info = useApiVersion()
  const [dismissed, setDismissed] = useState<string | null>(getDismissedVersion)

  const handleDismiss = useCallback(() => {
    if (info?.serverVersion) {
      setDismissedVersion(info.serverVersion)
      setDismissed(info.serverVersion)
    }
  }, [info])

  if (!info) return null
  if (info.compatibility === 'compatible' || info.compatibility === 'unknown') return null

  // Don't re-show the warning for the same server version the user already dismissed
  if (info.compatibility === 'minor-mismatch' && dismissed === info.serverVersion) return null

  const canDismiss = info.compatibility === 'minor-mismatch'
  const icon = iconByCompatibility[info.compatibility]
  const style = bannerStyles[info.compatibility]

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 border-b px-4 py-3 text-sm ${style}`}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-base">
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {info.compatibility === 'incompatible'
            ? 'API version incompatible'
            : 'API version mismatch'}
        </p>
        <p className="mt-0.5 opacity-80">{info.message}</p>

        {info.compatibility === 'incompatible' && (
          <p className="mt-1.5 opacity-70">
            Server: <code className="font-mono text-xs">{info.serverVersion ?? 'unknown'}</code>
            {' / '}
            Client: <code className="font-mono text-xs">{info.clientVersion}</code>
          </p>
        )}
      </div>

      {canDismiss && (
        <button
          onClick={handleDismiss}
          className="shrink-0 text-amber-300/70 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          aria-label="Dismiss API version warning"
          title="Dismiss"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  )
})
