import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWallet } from './WalletContext'

/**
 * Gates on-chain panels (deploy wizard, publish flow, etc.) behind a connected
 * wallet. Renders a friendly empty state with a connect button instead of the
 * gated content when no wallet is connected.
 */
export function RequireWallet({ children }: { children: ReactNode }): ReactElement {
  const { t } = useTranslation()
  const { status, connect, error } = useWallet()

  if (status === 'connected') return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-6 py-10 text-center">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {t('wallet.gate.title')}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        {t('wallet.gate.description')}
      </p>
      <button
        type="button"
        onClick={() => void connect()}
        disabled={status === 'connecting'}
        className="mt-1 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 transition-colors"
      >
        {status === 'connecting' ? t('wallet.connecting') : t('wallet.connect')}
      </button>
      {error && <p className="text-xs text-red-500 dark:text-red-400 max-w-sm">{error}</p>}
    </div>
  )
}
