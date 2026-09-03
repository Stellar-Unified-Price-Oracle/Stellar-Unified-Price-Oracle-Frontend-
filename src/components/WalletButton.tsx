import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { shortenAccount } from '../lib/stellarAssets'
import { useWallet } from '../wallet/WalletContext'

/**
 * Header wallet control: a "Connect Wallet" button when disconnected, or a
 * status chip (network, address, balance) with a disconnect action once connected.
 */
export function WalletButton(): ReactElement {
  const { t } = useTranslation()
  const { status, address, network, balance, balanceLoading, error, errorCode, connect, disconnect } =
    useWallet()
  const [menuOpen, setMenuOpen] = useState(false)

  if (status !== 'connected') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={status === 'connecting'}
          className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 transition-colors"
        >
          {status === 'connecting' ? t('wallet.connecting') : t('wallet.connect')}
        </button>
        {status === 'error' && error && (
          <span className="text-xs text-red-500 dark:text-red-400 max-w-[14rem] text-right">
            {errorCode === 'not-installed' ? (
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-red-600 dark:hover:text-red-300"
              >
                {t('wallet.installFreighter')}
              </a>
            ) : (
              error
            )}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={t('wallet.ariaConnected', { address: shortenAccount(address ?? '') })}
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
        <span className="hidden sm:inline">{network}</span>
        <span>{shortenAccount(address ?? '')}</span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 p-3 text-sm"
        >
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">{t('wallet.network')}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{network}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">{t('wallet.address')}</dt>
              <dd className="font-mono text-gray-900 dark:text-white">{shortenAccount(address ?? '')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">{t('wallet.balance')}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {balanceLoading ? '…' : balance !== null ? `${balance} XLM` : t('wallet.balanceUnfunded')}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              disconnect()
            }}
            className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            {t('wallet.disconnect')}
          </button>
        </div>
      )}
    </div>
  )
}
