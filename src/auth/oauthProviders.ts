import { config } from '../config'

export type OAuthProviderId = 'github' | 'google'

export interface OAuthProvider {
  id: OAuthProviderId
  label: string
  authorizeUrl: string
  clientId: string
  scope: string
}

/**
 * Identity providers for the dev-portal SSO (#501). `clientId` is public by
 * design (OAuth public-client PKCE flow); no secret is configured here or
 * anywhere else in the frontend.
 */
export const OAUTH_PROVIDERS: Record<OAuthProviderId, OAuthProvider> = {
  github: {
    id: 'github',
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    clientId: config.auth.githubClientId,
    scope: 'read:user user:email',
  },
  google: {
    id: 'google',
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: config.auth.googleClientId,
    scope: 'openid email profile',
  },
}

export function redirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/auth/callback`
}

/** Builds the provider authorize URL for an Authorization Code + PKCE request. */
export function buildAuthorizeUrl(
  provider: OAuthProvider,
  params: { state: string; codeChallenge: string },
): string {
  const url = new URL(provider.authorizeUrl)
  url.searchParams.set('client_id', provider.clientId)
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', provider.scope)
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // Google requires an explicit prompt to reliably re-show the consent screen
  // when a user signs in with a second Google account; harmless for GitHub.
  if (provider.id === 'google') url.searchParams.set('access_type', 'online')
  return url.toString()
}
