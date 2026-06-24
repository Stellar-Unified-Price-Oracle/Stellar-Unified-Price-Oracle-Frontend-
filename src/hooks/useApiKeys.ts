/**
 * Hook for managing API keys.
 * Handles create, revoke, and list operations.
 * Issue #92
 */

import { useState, useCallback } from 'react'
import type { ApiKey, ApiKeyFormData } from '../types'

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch all API keys
   */
  const fetchKeys = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/keys', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch keys')
      const data = (await response.json()) as ApiKey[]
      setKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new API key
   */
  const createKey = useCallback(
    async (formData: ApiKeyFormData): Promise<ApiKey | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error('Failed to create key')
        const newKey = (await response.json()) as ApiKey
        setKeys((prev) => [...prev, newKey])
        return newKey
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Revoke an API key
   */
  const revokeKey = useCallback(async (keyId: string): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
      })
      if (!response.ok) throw new Error('Failed to revoke key')
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }, [])

  /**
   * Get a specific key by ID
   */
  const getKey = useCallback((keyId: string): ApiKey | undefined => {
    return keys.find((k) => k.id === keyId)
  }, [keys])

  return {
    keys,
    isLoading,
    error,
    fetchKeys,
    createKey,
    revokeKey,
    getKey,
  }
}
