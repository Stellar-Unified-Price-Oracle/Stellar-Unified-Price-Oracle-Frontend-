import { memo, useEffect } from 'react'
import { useApiKeys } from '../hooks/useApiKeys'
import { ApiKeyForm } from '../components/ApiKeyForm'
import { ApiKeyList } from '../components/ApiKeyList'
import { useAnalytics } from '../context/AnalyticsContext'
import type { ApiKey, ApiKeyFormData } from '../types'

export const ApiKeysPage = memo(function ApiKeysPage() {
  const { keys, isLoading, error, fetchKeys, createKey, revokeKey } = useApiKeys()
  const { track } = useAnalytics()

  useEffect(() => {
    fetchKeys().catch(console.error)
    track('page_view', { page: 'api_keys' })
  }, [fetchKeys, track])

  const handleCreateKey = async (formData: ApiKeyFormData): Promise<ApiKey | null> => {
    track('api_key_created', { permissions: formData.permissions })
    return createKey(formData)
  }

  const handleRevokeKey = async (keyId: string) => {
    const success = await revokeKey(keyId)
    if (success) {
      track('api_key_revoked')
    }
    return success
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">API Key Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage API keys for programmatic access to the price feed.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      <ApiKeyForm onSubmit={handleCreateKey} isLoading={isLoading} />

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your Keys</h2>
        <ApiKeyList keys={keys} onRevoke={handleRevokeKey} isLoading={isLoading} />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📚 API Documentation</h3>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
          Use your API key in the Authorization header:
        </p>
        <code className="block bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100 p-2 rounded text-xs overflow-auto">
          curl -H "Authorization: Bearer YOUR_API_KEY" https://api.example.com/prices
        </code>
      </div>
    </div>
  )
})
