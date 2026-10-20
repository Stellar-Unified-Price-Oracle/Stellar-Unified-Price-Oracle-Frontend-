import type { ReactElement } from 'react'
import { useLocation } from 'react-router-dom'
import { useOptionalAuth } from './AuthContext'
import { LoginButtons } from './LoginButtons'

/**
 * Tells the user their sign-in ended while they were on a page (#844), so unsaved
 * work is not lost without warning. Signing in again returns them to this route.
 */
export function SessionExpiredBanner(): ReactElement | null {
  const auth = useOptionalAuth()
  const location = useLocation()
  if (!auth?.sessionExpired) return null

  return (
    <div role="alert" className="mx-6 mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-200">
        Your session has expired. Anything you have not saved on this page may be lost. Sign in again to continue.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <LoginButtons returnTo={`${location.pathname}${location.search}`} />
        <button
          type="button"
          onClick={auth.dismissSessionExpired}
          className="text-xs px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
