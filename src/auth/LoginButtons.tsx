import { type ReactElement } from 'react'
import { useAuth } from './AuthContext'
import { OAUTH_PROVIDERS } from './oauthProviders'

/** GitHub/Google SSO buttons for the dev-portal (#501). Redirect-based OAuth2/OIDC + PKCE. */
export function LoginButtons({ returnTo }: { returnTo?: string }): ReactElement {
  const { signIn } = useAuth()

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-xs">
      {Object.values(OAUTH_PROVIDERS).map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void signIn(provider.id, returnTo)}
          disabled={!provider.clientId}
          title={!provider.clientId ? `${provider.label} sign-in is not configured` : undefined}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-700 text-gray-200 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continue with {provider.label}
        </button>
      ))}
    </div>
  )
}
