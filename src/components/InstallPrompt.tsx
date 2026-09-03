import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Fires before the browser shows its own install UI, letting us render ours instead. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Prompts the user to install the app as a PWA (#361). */
export const InstallPrompt = memo(function InstallPrompt() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function handleAppInstalled() {
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (!deferredPrompt || dismissed) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="fixed bottom-4 left-4 z-50" role="alert">
      <div className="bg-gray-900/95 dark:bg-gray-900/95 border border-gray-700/50 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg shadow-black/30 flex items-center gap-3 max-w-sm">
        <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100">{t('pwa.installTitle')}</p>
          <p className="text-xs text-gray-400">{t('pwa.installDetail')}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            {t('pwa.installAction')}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {t('pwa.installDismiss')}
          </button>
        </div>
      </div>
    </div>
  )
})
