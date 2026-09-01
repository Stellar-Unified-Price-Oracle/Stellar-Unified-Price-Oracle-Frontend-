import { type ReactElement, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { LoginButtons } from './LoginButtons'

/**
 * Gates a developer feature (API keys, webhooks, …) behind a verified SSO
 * session (#501, acceptance criterion: "Gate developer features behind a
 * verified session"). Renders sign-in prompts instead of the feature until
 * `useAuth()` reports an authenticated session.
 */
export function DeveloperAuthGate({
  children,
  feature = 'this feature',
}: {
  children: ReactNode
  feature?: string
}): ReactElement {
  const { status } = useAuth()

  if (status === 'loading') {
    return <div className="py-6 text-center text-sm text-gray-500">Checking session…</div>
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-sm text-gray-400 max-w-xs">
          Sign in to access {feature}. Developer features require a verified session.
        </p>
        <LoginButtons />
      </div>
    )
  }

  return <>{children}</>
}
