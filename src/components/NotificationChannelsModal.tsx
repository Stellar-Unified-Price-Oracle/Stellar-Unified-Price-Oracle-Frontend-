import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'notification-channels'

interface NotificationConfig {
  email: { address: string; enabled: boolean }
  webPush: { enabled: boolean }
  webhook: { url: string; secret: string; enabled: boolean }
}

const DEFAULT_CONFIG: NotificationConfig = {
  email: { address: '', enabled: false },
  webPush: { enabled: false },
  webhook: { url: '', secret: '', enabled: false },
}

function loadConfig(): NotificationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<NotificationConfig>
    return {
      email: { ...DEFAULT_CONFIG.email, ...parsed.email },
      webPush: { ...DEFAULT_CONFIG.webPush, ...parsed.webPush },
      webhook: { ...DEFAULT_CONFIG.webhook, ...parsed.webhook },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

type TabId = 'email' | 'webpush' | 'webhook'

interface Props {
  isOpen: boolean
  onClose: () => void
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-green-400' : 'bg-gray-600'}`}
      aria-hidden="true"
    />
  )
}

export function NotificationChannelsModal({ isOpen, onClose }: Props) {
  const [config, setConfig] = useState<NotificationConfig>(loadConfig)
  const [activeTab, setActiveTab] = useState<TabId>('email')
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setTestStatus(null)
      requestAnimationFrame(() => dialogRef.current?.focus())
    }
  }, [isOpen])

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    onClose()
  }, [config, onClose])

  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setPushPermission(permission)
    if (permission === 'granted') {
      setConfig((c) => ({ ...c, webPush: { ...c.webPush, enabled: true } }))
    }
  }, [])

  const handleTest = useCallback(
    async (tab: TabId) => {
      setTestStatus(null)
      if (tab === 'webpush') {
        if (pushPermission !== 'granted') {
          setTestStatus('Grant browser permission first')
          return
        }
        new Notification('Test Notification', { body: 'This is a test price alert notification from the Oracle.' })
        setTestStatus('Notification sent')
      } else if (tab === 'email') {
        if (!config.email.address) {
          setTestStatus('Enter an email address first')
          return
        }
        setTestStatus(`Test email queued for ${config.email.address}`)
      } else if (tab === 'webhook') {
        if (!config.webhook.url) {
          setTestStatus('Enter a webhook URL first')
          return
        }
        try {
          await fetch(config.webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(config.webhook.secret ? { 'X-Webhook-Secret': config.webhook.secret } : {}),
            },
            body: JSON.stringify({ type: 'test', message: 'Test webhook from Stellar Price Oracle' }),
          })
          setTestStatus('Webhook test sent')
        } catch {
          setTestStatus('Webhook request failed — check URL and CORS settings')
        }
      }
    },
    [config.email.address, config.webhook.url, config.webhook.secret, pushPermission],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  if (!isOpen) return null

  const tabs: { id: TabId; label: string }[] = [
    { id: 'email', label: 'Email' },
    { id: 'webpush', label: 'Web Push' },
    { id: 'webhook', label: 'Webhook' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification channels configuration"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-white">Notification Channels</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-800 mb-5" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setTestStatus(null)
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'email' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusDot active={!!config.email.address && config.email.enabled} />
              <span className="text-sm text-gray-400">
                {config.email.address && config.email.enabled
                  ? `Configured: ${config.email.address}`
                  : 'Not configured'}
              </span>
            </div>
            <div>
              <label htmlFor="notif-email-address" className="block text-sm text-gray-400 mb-1.5">
                Email Address
              </label>
              <input
                id="notif-email-address"
                type="email"
                value={config.email.address}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, email: { ...c.email, address: e.target.value } }))
                }
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.email.enabled}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, email: { ...c.email, enabled: e.target.checked } }))
                }
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
              />
              <span className="text-sm text-gray-300">Enable email notifications</span>
            </label>
            <button
              type="button"
              onClick={() => handleTest('email')}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Send test email
            </button>
          </div>
        )}

        {activeTab === 'webpush' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusDot active={pushPermission === 'granted' && config.webPush.enabled} />
              <span className="text-sm text-gray-400">
                Permission:{' '}
                <span
                  className={
                    pushPermission === 'granted'
                      ? 'text-green-400'
                      : pushPermission === 'denied'
                        ? 'text-red-400'
                        : 'text-gray-400'
                  }
                >
                  {pushPermission}
                </span>
              </span>
            </div>
            {pushPermission !== 'granted' ? (
              <button
                type="button"
                onClick={requestPushPermission}
                disabled={pushPermission === 'denied'}
                className="w-full py-2.5 text-sm rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pushPermission === 'denied'
                  ? 'Permission denied — enable in browser settings'
                  : 'Grant browser permission'}
              </button>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.webPush.enabled}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, webPush: { ...c.webPush, enabled: e.target.checked } }))
                  }
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                />
                <span className="text-sm text-gray-300">Enable web push notifications</span>
              </label>
            )}
            <button
              type="button"
              onClick={() => handleTest('webpush')}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Send test notification
            </button>
          </div>
        )}

        {activeTab === 'webhook' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusDot active={!!config.webhook.url && config.webhook.enabled} />
              <span className="text-sm text-gray-400">
                {config.webhook.url && config.webhook.enabled ? 'Configured' : 'Not configured'}
              </span>
            </div>
            <div>
              <label htmlFor="notif-webhook-url" className="block text-sm text-gray-400 mb-1.5">
                Webhook URL
              </label>
              <input
                id="notif-webhook-url"
                type="url"
                value={config.webhook.url}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, webhook: { ...c.webhook, url: e.target.value } }))
                }
                placeholder="https://your-server.com/webhook"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label htmlFor="notif-webhook-secret" className="block text-sm text-gray-400 mb-1.5">
                Secret <span className="text-gray-600">(optional)</span>
              </label>
              <input
                id="notif-webhook-secret"
                type="password"
                value={config.webhook.secret}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, webhook: { ...c.webhook, secret: e.target.value } }))
                }
                placeholder="Signing secret"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.webhook.enabled}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, webhook: { ...c.webhook, enabled: e.target.checked } }))
                }
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
              />
              <span className="text-sm text-gray-300">Enable webhook notifications</span>
            </label>
            <button
              type="button"
              onClick={() => handleTest('webhook')}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Send test request
            </button>
          </div>
        )}

        {testStatus && (
          <p className="mt-3 text-sm text-cyan-400" role="status">
            {testStatus}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="px-4 py-2 text-sm text-white bg-cyan-600 rounded-xl hover:bg-cyan-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
