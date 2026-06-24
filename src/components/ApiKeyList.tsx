/**
 * API key list and management component.
 * Issue #92
 */

import { memo, useState, useCallback } from 'react'
import type { ApiKey } from '../types'

interface ApiKeyListProps {
  keys: ApiKey[]
  onRevoke: (keyId: string) => Promise<boolean>
  isLoading?: boolean
}

export const ApiKeyList = memo(function ApiKeyList({ keys, onRevoke, isLoading }: ApiKeyListProps) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [revoking, setRevoking] = useState<string | null>(null)

  const toggleReveal = useCallback((keyId: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(keyId)) {
        next.delete(keyId)
      } else {
        next.add(keyId)
      }
      return next
    })
  }, [])

  const handleRevoke = useCallback(
    async (keyId: string) => {
      if (
        !window.confirm(
          'Are you sure you want to revoke this key? This action cannot be undone.'
        )
      ) {
        return
      }

      setRevoking(keyId)
      const success = await onRevoke(keyId)
      if (success) {
        setRevealedKeys((prev) => {
          const next = new Set(prev)
          next.delete(keyId)
          return next
        })
      }
      setRevoking(null)
    },
    [onRevoke]
  )

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(console.error)
  }, [])

  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No API keys yet. Create your first key to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <div
          key={key.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{key.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Created {new Date(key.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(revealedKeys.has(key.id) ? key.key : key.maskedKey)}
                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={() => toggleReveal(key.id)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {revealedKeys.has(key.id) ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded font-mono text-sm text-gray-700 dark:text-gray-300 break-all mb-3">
            {revealedKeys.has(key.id) ? key.key : key.maskedKey}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Permissions</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {key.permissions.join(', ')}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Quota</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {key.quotaUsed}/{key.quotaLimit}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Last Used</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {key.lastUsedAt
                  ? new Date(key.lastUsedAt).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <p className={`font-medium ${key.active ? 'text-green-600' : 'text-red-600'}`}>
                {key.active ? 'Active' : 'Revoked'}
              </p>
            </div>
          </div>

          {key.active && (
            <button
              onClick={() => handleRevoke(key.id)}
              disabled={revoking === key.id || isLoading}
              className="w-full px-3 py-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {revoking === key.id ? 'Revoking...' : 'Revoke Key'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
})
