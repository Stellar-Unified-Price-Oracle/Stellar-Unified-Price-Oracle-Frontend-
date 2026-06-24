/**
 * Form component for creating new API keys.
 * Issue #92
 */

import { memo, useState, useCallback } from 'react'
import type { ApiKey, ApiKeyFormData, ApiKeyPermission } from '../types'

interface ApiKeyFormProps {
  onSubmit: (formData: ApiKeyFormData) => Promise<ApiKey | null>
  isLoading?: boolean
}

const PERMISSION_OPTIONS: ApiKeyPermission[] = ['read', 'write', 'admin']

export const ApiKeyForm = memo(function ApiKeyForm({ onSubmit, isLoading }: ApiKeyFormProps) {
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<Set<ApiKeyPermission>>(new Set(['read']))
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKey, setNewKey] = useState<ApiKey | null>(null)

  const handlePermissionToggle = useCallback((permission: ApiKeyPermission) => {
    setPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) {
        // Don't allow empty permissions
        if (next.size > 1) {
          next.delete(permission)
        }
      } else {
        next.add(permission)
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!name.trim()) {
        alert('Please enter a name for this key')
        return
      }

      const formData: ApiKeyFormData = {
        name: name.trim(),
        permissions: Array.from(permissions),
      }

      const result = await onSubmit(formData)
      if (result) {
        setNewKey(result)
        setShowNewKey(true)
        setName('')
        setPermissions(new Set(['read']))
      }
    },
    [name, permissions, onSubmit]
  )

  const copyNewKey = useCallback(() => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.key).catch(console.error)
      alert('Key copied to clipboard!')
    }
  }, [newKey])

  if (showNewKey && newKey) {
    return (
      <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4">
          ✓ API Key Created
        </h3>
        <div className="mb-4">
          <p className="text-sm text-green-800 dark:text-green-200 mb-3">
            Save this key now. You won't be able to see it again!
          </p>
          <div className="bg-white dark:bg-gray-900 p-3 rounded font-mono text-sm text-gray-700 dark:text-gray-300 break-all border border-green-200 dark:border-green-800">
            {newKey.key}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={copyNewKey}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
          >
            Copy Key
          </button>
          <button
            onClick={() => setShowNewKey(false)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New API Key</h3>

      <div className="mb-4">
        <label htmlFor="key-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Key Name
        </label>
        <input
          id="key-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Production API Key"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Permissions
        </label>
        <div className="space-y-2">
          {PERMISSION_OPTIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={permissions.has(permission)}
                onChange={() => handlePermissionToggle(permission)}
                disabled={isLoading || (permissions.size === 1 && permissions.has(permission))}
                className="rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                {permission}
                {permission === 'read' && ' - Fetch prices and data'}
                {permission === 'write' && ' - Create and update alerts'}
                {permission === 'admin' && ' - Full access including key management'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition-colors"
      >
        {isLoading ? 'Creating...' : 'Create API Key'}
      </button>
    </form>
  )
})
