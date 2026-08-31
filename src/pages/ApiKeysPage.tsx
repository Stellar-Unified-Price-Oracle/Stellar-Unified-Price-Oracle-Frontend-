import { useState, useCallback, useRef } from 'react'
import { useApiKeys } from '../context/ApiKeysContext'
import type { ApiKey } from '../types'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SignInPanel() {
  const { signIn, isLoading, error } = useApiKeys()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) return
      await signIn(email.trim())
      setSubmitted(true)
    },
    [email, signIn],
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
            D
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Developer Portal</h1>
          <p className="text-gray-400 text-sm">Sign in to manage your API keys and usage.</p>
        </div>

        {submitted && !error ? (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5 text-center">
            <svg className="w-10 h-10 text-cyan-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-cyan-300 font-medium">Check your inbox</p>
            <p className="text-gray-400 text-sm mt-1">We sent a magic link to <strong className="text-white">{email}</strong></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="dev-email" className="block text-sm font-medium text-gray-400 mb-1.5">
                Email address
              </label>
              <input
                id="dev-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-400" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {isLoading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface KeyRowProps {
  apiKey: ApiKey
  usageRequests: number
  usageWebhooks: number
  rateLimitRemaining: number
  rateLimitTotal: number
  onRevoke: (id: string) => void
  onRename: (id: string, name: string) => void
  onAcknowledge: (id: string) => void
}

function KeyRow({
  apiKey,
  usageRequests,
  usageWebhooks,
  rateLimitRemaining,
  rateLimitTotal,
  onRevoke,
  onRename,
  onAcknowledge,
}: KeyRowProps) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(apiKey.name)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isRevoked = apiKey.status === 'revoked'

  const handleRenameSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = nameInput.trim()
      if (trimmed && trimmed !== apiKey.name) {
        onRename(apiKey.id, trimmed)
      }
      setEditing(false)
    },
    [nameInput, apiKey.id, apiKey.name, onRename],
  )

  const handleCopy = useCallback(async () => {
    if (!apiKey.plaintextValue) return
    try {
      await navigator.clipboard.writeText(apiKey.plaintextValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [apiKey.plaintextValue])

  const ratePct = rateLimitTotal > 0 ? (rateLimitRemaining / rateLimitTotal) * 100 : 0

  return (
    <div
      className={`bg-gray-900 border rounded-xl p-5 transition-opacity ${isRevoked ? 'border-gray-800 opacity-50' : 'border-gray-700'}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
                className="flex-1 bg-gray-800 border border-cyan-500 rounded-lg px-3 py-1 text-white text-sm focus:outline-none"
                aria-label="Rename API key"
              />
              <button
                type="submit"
                className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded"
              >
                Save
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">{apiKey.name}</span>
              {!isRevoked && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setNameInput(apiKey.name) }}
                  className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                  aria-label={`Rename key ${apiKey.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            Created {new Date(apiKey.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isRevoked
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}
          >
            {isRevoked ? 'Revoked' : 'Active'}
          </span>

          {!isRevoked && (
            <button
              type="button"
              onClick={() => onRevoke(apiKey.id)}
              className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              Revoke
            </button>
          )}
        </div>
      </div>

      {/* Key value — shown once at creation */}
      {apiKey.plaintextValue ? (
        <div className="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <p className="text-xs text-amber-400 font-medium mb-2">
            ⚠ Copy your key now — it will not be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-white bg-gray-800 rounded px-3 py-2 select-all break-all">
              {apiKey.plaintextValue}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 rounded-lg transition-colors"
              aria-label="Copy API key"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAcknowledge(apiKey.id)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
          >
            I've saved it — dismiss
          </button>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-gray-400 bg-gray-800 rounded px-3 py-2">
            {apiKey.maskedValue}
          </code>
        </div>
      )}

      {/* Usage stats */}
      {!isRevoked && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-800 rounded-lg p-2">
            <p className="text-lg font-bold text-white tabular-nums">{usageRequests.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Requests today</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <p className="text-lg font-bold text-white tabular-nums">{usageWebhooks.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Webhooks today</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <p className="text-lg font-bold text-white tabular-nums">{rateLimitRemaining.toLocaleString()}</p>
              <p className="text-xs text-gray-500">/ {rateLimitTotal.toLocaleString()}</p>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1 mt-1 mb-0.5">
              <div
                className={`h-1 rounded-full transition-all ${ratePct > 30 ? 'bg-cyan-500' : 'bg-red-500'}`}
                style={{ width: `${ratePct}%` }}
                role="progressbar"
                aria-valuenow={rateLimitRemaining}
                aria-valuemin={0}
                aria-valuemax={rateLimitTotal}
                aria-label="Rate limit remaining"
              />
            </div>
            <p className="text-xs text-gray-500">Rate limit</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create key modal
// ---------------------------------------------------------------------------

interface CreateKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => void
  isLoading: boolean
}

function CreateKeyModal({ isOpen, onClose, onCreate, isLoading }: CreateKeyModalProps) {
  const [name, setName] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) return
      onCreate(trimmed)
      setName('')
    },
    [name, onCreate],
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create API key"
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Create API Key</h2>
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label htmlFor="key-name" className="block text-sm font-medium text-gray-400 mb-1.5">
              Key name
            </label>
            <input
              id="key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
              placeholder="e.g. Production Feed Consumer"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Give your key a descriptive name so you can identify it later.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-xl hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {isLoading ? 'Creating…' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApiKeysPage() {
  const {
    session,
    keys,
    usageStats,
    isLoading,
    error,
    signOut,
    createKey,
    revokeKey,
    renameKey,
    acknowledgeKeyValue,
  } = useApiKeys()

  const [createModalOpen, setCreateModalOpen] = useState(false)

  const handleCreate = useCallback(
    async (name: string) => {
      await createKey(name)
      setCreateModalOpen(false)
    },
    [createKey],
  )

  if (!session) {
    return <SignInPanel />
  }

  const activeKeys = keys.filter((k) => k.status === 'active')
  const revokedKeys = keys.filter((k) => k.status === 'revoked')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Developer Portal</h1>
          <p className="text-sm text-gray-400 mt-1">
            Signed in as <span className="text-white">{session.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New API Key
          </button>
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400" role="alert">
          {error}
        </div>
      )}

      {/* Active keys */}
      <section aria-label="Active API keys" className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Active Keys ({activeKeys.length})
        </h2>

        {activeKeys.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <svg className="w-10 h-10 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-gray-400 text-sm">No API keys yet.</p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors underline"
            >
              Create your first key
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeKeys.map((key) => {
              const stats = usageStats.get(key.id)
              return (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  usageRequests={stats?.requestsToday ?? 0}
                  usageWebhooks={stats?.webhookDeliveriesToday ?? 0}
                  rateLimitRemaining={stats?.rateLimitRemaining ?? 0}
                  rateLimitTotal={stats?.rateLimitTotal ?? 1000}
                  onRevoke={revokeKey}
                  onRename={renameKey}
                  onAcknowledge={acknowledgeKeyValue}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <section aria-label="Revoked API keys">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Revoked ({revokedKeys.length})
          </h2>
          <div className="space-y-3">
            {revokedKeys.map((key) => (
              <KeyRow
                key={key.id}
                apiKey={key}
                usageRequests={0}
                usageWebhooks={0}
                rateLimitRemaining={0}
                rateLimitTotal={1000}
                onRevoke={revokeKey}
                onRename={renameKey}
                onAcknowledge={acknowledgeKeyValue}
              />
            ))}
          </div>
        </section>
      )}

      <CreateKeyModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
        isLoading={isLoading}
      />
    </div>
  )
}
