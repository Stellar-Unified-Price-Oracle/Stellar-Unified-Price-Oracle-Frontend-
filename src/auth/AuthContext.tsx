import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { config } from '../config'
import { createPkceParams } from './pkce'
import { OAUTH_PROVIDERS, buildAuthorizeUrl, redirectUri, type OAuthProviderId } from './oauthProviders'
import { fetchSession, exchangeCode, signOut as apiSignOut, signOutEverywhere as apiSignOutEverywhere, type AuthUser } from './authApi'

/** Session-storage keys for the in-flight PKCE attempt. Single-use, non-credential nonces only. */
const PKCE_VERIFIER_KEY = 'stellar-oracle:auth-pkce-verifier'
const PKCE_STATE_KEY = 'stellar-oracle:auth-pkce-state'
const PKCE_PROVIDER_KEY = 'stellar-oracle:auth-pkce-provider'
const RETURN_TO_KEY = 'stellar-oracle:auth-return-to'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  /** Starts the redirect-based OAuth2/OIDC + PKCE sign-in flow. */
  signIn: (provider: OAuthProviderId, returnTo?: string) => Promise<void>
  /** Completes the flow after the provider redirects back to /auth/callback. */
  completeSignIn: (search: string) => Promise<{ returnTo: string }>
  signOut: () => Promise<void>
  signOutEverywhere: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const session = await fetchSession()
    if (!mountedRef.current) return
    setUser(session)
    setStatus(session ? 'authenticated' : 'unauthenticated')
  }, [])

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
      setUser(signedInUser)
      setStatus('authenticated')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      setStatus('unauthenticated')
      throw e
    }
    return { returnTo }
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const signOutEverywhere = useCallback(async () => {
    await apiSignOutEverywhere()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, error, signIn, completeSignIn, signOut, signOutEverywhere }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
