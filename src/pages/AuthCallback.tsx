import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** OAuth2/OIDC redirect target for the dev-portal SSO flow (#501). */
export function AuthCallback(): ReactElement {
  const { completeSignIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    completeSignIn(window.location.search)
      .then(({ returnTo }) => {
        if (!cancelled) navigate(returnTo, { replace: true })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Sign-in failed')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for this redirect
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="text-xl font-semibold text-red-500 mb-3">Sign-in failed</h1>
        <p className="text-sm text-gray-400 mb-6">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400 text-sm">
      Completing sign-in…
    </div>
  )
}
