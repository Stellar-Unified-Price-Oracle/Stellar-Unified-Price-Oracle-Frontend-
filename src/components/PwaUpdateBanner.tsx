import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAppVersion } from '../api/version'
import { applyServiceWorkerUpdate, registerServiceWorker } from '../utils/registerServiceWorker'
import { broadcastSwUpdate, subscribeToSwUpdates } from '../utils/swUpdateChannel'
import { readRaw, STORAGE_KEYS, writeRaw } from '../utils/storage'

const UPDATE_DISMISSAL_MS = 6 * 60 * 60 * 1000

function readUpdateDismissedUntil(): number {
  const value = Number(readRaw(STORAGE_KEYS.pwaUpdateDismissed))
  return Number.isFinite(value) && value > Date.now() ? value : 0
}

/** Prompts users to reload atomically when a new service worker is waiting. */
export const PwaUpdateBanner = memo(function PwaUpdateBanner() {
  const { t } = useTranslation()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateDismissedUntil, setUpdateDismissedUntil] = useState(readUpdateDismissedUntil)
  const [error, setError] = useState(false)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [applying, setApplying] = useState(false)
  // Another tab has started applying this update, so this tab must not race it (#832)
  const [peerApplying, setPeerApplying] = useState(false)

  useEffect(
    () =>
      subscribeToSwUpdates((message) => {
        if (message.type === 'applying') {
          setPeerApplying(true)
        } else {
          setUpdateDismissedUntil(message.until)
        }
      }),
    [],
  )

  useEffect(
    () =>
      registerServiceWorker({
        onUpdateAvailable: (value) => {
          setRegistration(value)
          setOfflineReady(false)
          setError(false)
          setErrorDismissed(false)
        },
        onOfflineReady: () => {
          setOfflineReady(true)
          setError(false)
          setErrorDismissed(false)
        },
        onError: () => {
          setError(true)
          setErrorDismissed(false)
        },
      }),
    [],
  )

  async function handleUpdate() {
    if (!registration || applying || peerApplying) return
    setApplying(true)
    setError(false)
    broadcastSwUpdate({ type: 'applying' })
    try {
      await applyServiceWorkerUpdate(registration)
    } catch {
      setApplying(false)
      setError(true)
      setErrorDismissed(false)
    }
  }

  function dismissUpdate() {
    const until = Date.now() + UPDATE_DISMISSAL_MS
    writeRaw(STORAGE_KEYS.pwaUpdateDismissed, String(until))
    broadcastSwUpdate({ type: 'dismissed', until })
    setUpdateDismissedUntil(until)
  }

  if (error && !errorDismissed) {
    return (
      <div className="fixed bottom-24 start-4 z-50 max-w-sm" role="alert">
        <div className="rounded-xl border border-amber-700/50 bg-gray-900/95 px-4 py-3 text-sm text-amber-100 shadow-lg">
          <p>{t('pwa.errorTitle')}</p>
          <p className="mt-1 text-xs text-gray-300">{t('pwa.errorDetail')}</p>
          <button
            type="button"
            onClick={() => setErrorDismissed(true)}
            className="mt-2 text-xs text-gray-300 underline underline-offset-2"
          >
            {t('pwa.dismissError')}
          </button>
        </div>
      </div>
    )
  }

  if (registration && updateDismissedUntil <= Date.now()) {
    return (
      <div className="fixed bottom-24 start-4 z-50" role="region" aria-label={t('pwa.updateTitle')}>
        <div className="bg-gray-900/95 dark:bg-gray-900/95 border border-cyan-700/50 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg shadow-black/30 flex items-center gap-3 max-w-sm">
          <svg
            className="w-5 h-5 text-cyan-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-100">{t('pwa.updateTitle')}</p>
            <p className="text-xs text-cyan-200">{t('pwa.updateVersion', { version: getAppVersion() })}</p>
            <p className="text-xs text-gray-400">{t('pwa.updateNotes')}</p>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void handleUpdate()}
              disabled={applying || peerApplying}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-700 hover:bg-cyan-600 text-white transition-colors disabled:opacity-60"
            >
              {applying || peerApplying ? t('pwa.updating') : t('pwa.updateAction')}
            </button>
            <button
              type="button"
              onClick={dismissUpdate}
              className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              {t('pwa.updateDismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="fixed bottom-24 start-4 z-50" role="status" aria-live="polite">
        <div className="flex max-w-sm items-center gap-3 rounded-xl border border-emerald-700/50 bg-gray-900/95 px-4 py-3 text-sm text-emerald-100 shadow-lg">
          <p>{t('pwa.offlineReady')}</p>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className="shrink-0 text-xs text-gray-300 underline underline-offset-2"
          >
            {t('pwa.dismissError')}
          </button>
        </div>
      </div>
    )
  }

  return null
})
