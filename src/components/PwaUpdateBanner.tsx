import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyServiceWorkerUpdate, registerServiceWorker } from '../utils/registerServiceWorker'

/** Prompts the user to reload once a new service worker version is waiting (#361). */
export const PwaUpdateBanner = memo(function PwaUpdateBanner() {
  const { t } = useTranslation()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    registerServiceWorker(setRegistration)
  }, [])

  if (!registration) return null

  return (
    <div className="fixed bottom-24 left-4 z-50" role="alert">
      <div className="bg-gray-900/95 dark:bg-gray-900/95 border border-cyan-700/50 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg shadow-black/30 flex items-center gap-3 max-w-sm">
        <svg className="w-5 h-5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100">{t('pwa.updateTitle')}</p>
          <p className="text-xs text-gray-400">{t('pwa.updateDetail')}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => applyServiceWorkerUpdate(registration)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            {t('pwa.updateAction')}
          </button>
          <button
            type="button"
            onClick={() => setRegistration(null)}
            className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {t('pwa.updateDismiss')}
          </button>
        </div>
      </div>
    </div>
  )
})
