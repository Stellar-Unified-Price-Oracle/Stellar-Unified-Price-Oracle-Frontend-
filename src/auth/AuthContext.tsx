import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { config } from '../config'
import { createPkceParams } from './pkce'
import { OAUTH_PROVIDERS, buildAuthorizeUrl, redirectUri, type OAuthProviderId } from './oauthProviders'
import { fetchSession, exchangeCode, signOut as apiSignOut, signOutEverywhere as apiSignOutEverywhere, type AuthUser } from './authApi'
import { isSessionExpiry } from './sessionExpiry'

/** Session-storage keys for the in-flight PKCE attempt. Single-use, non-credential nonces only. */
const PKCE_VERIFIER_KEY = 'stellar-oracle:auth-pkce-verifier'
const PKCE_STATE_KEY = 'stellar-oracle:auth-pkce-state'
const PKCE_PROVIDER_KEY = 'stellar-oracle:auth-pkce-provider'
const RETURN_TO_KEY = 'stellar-oracle:auth-return-to'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/**
 * Authorization scopes. Authentication answers "is someone signed in";
 * authorization answers "is this user allowed to do this". Every gated
 * route/action must declare the scope it requires so the check is explicit
 * and testable rather than implied by the presence of a session.
 */
export type AuthScope =
  | 'wallet:read'
  | 'wallet:write'
  | 'developer:read'
  | 'developer:write'
  | 'admin'

/**
 * Centralized route/action -> required scope mapping. This is the single
 * source of truth for authorization. Adding a new gated route without an
 * entry here is caught by the authz coverage test (and thus CI).
 */
export const ROUTE_SCOPES = {
  '/wallet': 'wallet:read',
  '/wallet/send': 'wallet:write',
  '/developer': 'developer:read',
  '/developer/settings': 'developer:write',
  '/admin': 'admin',
} as const satisfies Record<string, AuthScope>

export type GatedRoute = keyof typeof ROUTE_SCOPES

/**
 * Returns the scope required for a gated route, or null when the route is
 * not gated. Callers must treat a null result as "no authz entry" and fail
 * closed rather than granting access.
 */
export function requiredScopeFor(route: string): AuthScope | null {
  return (ROUTE_SCOPES as Record<string, AuthScope>)[route] ?? null
}

/**
 * Authorization check: an authenticated user is only authorized when their
 * granted scopes include the scope required by the route/action. Fails
 * closed for unknown routes and for users without the required scope.
 */
export function isAuthorized(user: AuthUser | null, route: string): boolean {
  if (!user) return false
  const required = requiredScopeFor(route)
  if (!required) return false
  const granted = user.scopes ?? []
  return granted.includes(required)
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  /**
   * True when the server ended the session while the user was signed in, so
   * the UI can warn before in-progress work is discarded. Cleared on sign-in
   * or by {@link dismissSessionExpired}. Explicit sign-out never sets it.
   */
  sessionExpired: boolean
  dismissSessionExpired: () => void
  /** Starts the redirect-based OAuth2/OIDC + PKCE sign-in flow. */
  signIn: (provider: OAuthProviderId, returnTo?: string) => Promise<void>
  /** Completes the flow after the provider redirects back to /auth/callback. */
  completeSignIn: (search: string) => Promise<{ returnTo: string }>
  signOut: () => Promise<void>
  signOutEverywhere: () => Promise<void>
  /** Authorization check for a gated route/action. */
  isAuthorized: (route: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Last status a session check or sign-in observed. Read synchronously so an
  // async refresh compares against the true previous state, not a stale render.
  const statusRef = useRef<AuthStatus>('loading')
  const mountedRef = useRef(true)
  // Whether this tab last saw a live session. Lets a server-side expiry be told
  // apart from a user who was never signed in, or who signed out on purpose.
  const hadSessionRef = useRef(false)

  const refresh = useCallback(async () => {
    const check = await checkSession()
    if (!mountedRef.current) return
    const next: AuthStatus = session ? 'authenticated' : 'unauthenticated'
    // fetchSession also maps network failures to null, so a brief outage can
    // read as an expiry. Accepted: the warning is dismissible and non-destructive.
    if (isSessionExpiry(statusRef.current, next)) setSessionExpired(true)
    if (session) setSessionExpired(false)
    statusRef.current = next
    setUser(session)
    setStatus(next)
  }, [])

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), [])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    // Silently re-validate the session cookie on an interval so an expired
    // or server-revoked ("sign out everywhere") session is reflected in the
    // UI without requiring a page reload.
    const interval = setInterval(() => void refresh(), config.auth.sessionCheckIntervalMs)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [refresh])

  const signIn = useCallback(async (providerId: OAuthProviderId, returnTo = '/') => {
    setError(null)
    const provider = OAUTH_PROVIDERS[providerId]
    const { verifier, challenge, state } = await createPkceParams()
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
    sessionStorage.setItem(PKCE_STATE_KEY, state)
    sessionStorage.setItem(PKCE_PROVIDER_KEY, providerId)
    sessionStorage.setItem(RETURN_TO_KEY, returnTo)
    window.location.assign(buildAuthorizeUrl(provider, { state, codeChallenge: challenge }))
  }, [])

  const completeSignIn = useCallback(async (search: string) => {
    const params = new URLSearchParams(search)
    const code = params.get('code')
    const returnedState = params.get('state')
    const oauthError = params.get('error')

    const expectedState = sessionStorage.getItem(PKCE_STATE_KEY)
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
    const providerId = sessionStorage.getItem(PKCE_PROVIDER_KEY) as OAuthProviderId | null
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY) ?? '/'

    // Single-use: clear the PKCE nonces as soon as we've read them, regardless of outcome.
    sessionStorage.removeItem(PKCE_VERIFIER_KEY)
    sessionStorage.removeItem(PKCE_STATE_KEY)
    sessionStorage.removeItem(PKCE_PROVIDER_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)

    if (oauthError) throw new Error(`Provider denied sign-in: ${oauthError}`)
    if (!code || !returnedState || !verifier || !providerId) throw new Error('Sign-in response is incomplete.')
    if (returnedState !== expectedState) throw new Error('State mismatch — possible CSRF, sign-in aborted.')

    try {
      const signedInUser = await exchangeCode(providerId, code, verifier, redirectUri())
      hadSessionRef.current = true
      setUser(signedInUser)
      setStatus('authenticated')
      statusRef.current = 'authenticated'
      setSessionExpired(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setStatus('unauthenticated')
      statusRef.current = 'unauthenticated'
      throw e
    }
    return { returnTo }
  }, [])

  // An explicit sign-out is not an expiry, so mark the session as ended before the
  // request; a refresh racing with it then will not raise the expired banner.
  const signOut = useCallback(async () => {
    hadSessionRef.current = false
    await apiSignOut()
    setUser(null)
    setSessionExpired(false)
    setStatus('unauthenticated')
    statusRef.current = 'unauthenticated'
  }, [])

  const signOutEverywhere = useCallback(async () => {
    hadSessionRef.current = false
    await apiSignOutEverywhere()
    setUser(null)
    setSessionExpired(false)
    setStatus('unauthenticated')
    statusRef.current = 'unauthenticated'
  }, [])

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), [])

  const checkAuthorized = useCallback((route: string) => isAuthorized(user, route), [user])

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        error,
        sessionExpired,
        dismissSessionExpired,
        signIn,
        completeSignIn,
        signOut,
        signOutEverywhere,
        isAuthorized: checkAuthorized,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/** Like {@link useAuth}, but returns `null` outside an AuthProvider instead of throwing. */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
