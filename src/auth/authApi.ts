import { config } from '../config'

/**
 * Backend contract for the dev-portal SSO session (#501).
 *
 * The frontend never sees an access/refresh token — the backend sets it as
 * an httpOnly, `SameSite=Lax`, `Secure` cookie on exchange, so none of this
 * module touches localStorage/sessionStorage for anything credential-shaped
 * (PKCE verifier/state are the only session-storage values, and those are
 * single-use, non-credential nonces).
 *
 *   GET  /auth/session            -> { user } | 401
 *   POST /auth/callback/:provider -> { user }   body: { code, codeVerifier, redirectUri }
 *   POST /auth/signout            -> 204
 *   POST /auth/signout-all        -> 204        (sign-out-everywhere)
 */

export interface AuthUser {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
  provider: 'github' | 'google'
}

const AUTH_BASE = `${config.apiUrl}/auth`

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${AUTH_BASE}${path}`, {
    ...init,
    credentials: 'include', // send/receive the httpOnly session cookie
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
}

/** Outcome of a session check. `expired` means the server rejected the session (401). */
export type SessionCheck = { state: 'authenticated'; user: AuthUser } | { state: 'expired' } | { state: 'unavailable' }

/**
 * Checks the current session. It distinguishes a session the server rejected
 * from a check that could not complete (network failure, 5xx), so a flaky
 * connection is not mistaken for an expired login (#844).
 */
export async function checkSession(): Promise<SessionCheck> {
  try {
    const res = await authFetch('/session')
    if (res.status === 401) return { state: 'expired' }
    if (!res.ok) return { state: 'unavailable' }
    const data = (await res.json()) as { user: AuthUser }
    return { state: 'authenticated', user: data.user }
  } catch {
    return { state: 'unavailable' }
  }
}

/** Exchanges an OAuth authorization code (+ PKCE verifier) for a session cookie. */
export async function exchangeCode(
  provider: 'github' | 'google',
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<AuthUser> {
  const res = await authFetch(`/callback/${provider}`, {
    method: 'POST',
    body: JSON.stringify({ code, codeVerifier, redirectUri }),
  })
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`)
  const data = (await res.json()) as { user: AuthUser }
  return data.user
}

/** Ends the current session only. */
export async function signOut(): Promise<void> {
  await authFetch('/signout', { method: 'POST' })
}

/** Ends every session for this user (all devices/browsers). */
export async function signOutEverywhere(): Promise<void> {
  await authFetch('/signout-all', { method: 'POST' })
}
