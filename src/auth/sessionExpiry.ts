import type { AuthStatus } from './AuthContext'

/**
 * True only for the authenticated → unauthenticated transition seen by the
 * background session check, which means the server ended the session under
 * the user. An explicit sign-out is not an expiry and must not be passed here,
 * so callers keep their tracked status in step with sign-out.
 */
export function isSessionExpiry(previous: AuthStatus, next: AuthStatus): boolean {
  return previous === 'authenticated' && next === 'unauthenticated'
}
