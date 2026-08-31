import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  type ReactNode,
} from 'react'
import type {
  ApiKey,
  ApiKeyUsageStats,
  ApiKeysContextType,
  DevSession,
} from '../types'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ApiKeysState {
  session: DevSession | null
  keys: ApiKey[]
  usageStats: Map<string, ApiKeyUsageStats>
  isLoading: boolean
  error: string | null
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SESSION'; payload: DevSession | null }
  | { type: 'ADD_KEY'; payload: ApiKey }
  | { type: 'REVOKE_KEY'; payload: string }
  | { type: 'RENAME_KEY'; payload: { id: string; name: string } }
  | { type: 'ACKNOWLEDGE_KEY'; payload: string }
  | { type: 'SET_USAGE'; payload: ApiKeyUsageStats }

function reducer(state: ApiKeysState, action: Action): ApiKeysState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'SET_SESSION':
      return { ...state, session: action.payload, error: null }
    case 'ADD_KEY':
      return { ...state, keys: [...state.keys, action.payload] }
    case 'REVOKE_KEY':
      return {
        ...state,
        keys: state.keys.map((k) =>
          k.id === action.payload ? { ...k, status: 'revoked' } : k,
        ),
      }
    case 'RENAME_KEY':
      return {
        ...state,
        keys: state.keys.map((k) =>
          k.id === action.payload.id ? { ...k, name: action.payload.name } : k,
        ),
      }
    case 'ACKNOWLEDGE_KEY':
      // Clear the one-time plaintext value after the user has copied it
      return {
        ...state,
        keys: state.keys.map((k) =>
          k.id === action.payload ? { ...k, plaintextValue: null } : k,
        ),
      }
    case 'SET_USAGE': {
      const next = new Map(state.usageStats)
      next.set(action.payload.keyId, action.payload)
      return { ...state, usageStats: next }
    }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ApiKeysContext = createContext<ApiKeysContextType | null>(null)

// ---------------------------------------------------------------------------
// Helpers — simulated async operations (replace with real API calls later)
// ---------------------------------------------------------------------------

function generateKeyValue(): string {
  // Format: sk_live_<32 hex chars>
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `sk_live_${hex}`
}

function maskKeyValue(plain: string): string {
  if (plain.length <= 8) return '••••••••'
  return `${plain.slice(0, 8)}${'•'.repeat(Math.max(0, plain.length - 12))}${plain.slice(-4)}`
}

function simulatedUsage(keyId: string): ApiKeyUsageStats {
  // Deterministic-ish mock stats until the API exposes a usage endpoint
  const seed = keyId.charCodeAt(0) + keyId.charCodeAt(1)
  return {
    keyId,
    requestsToday: (seed * 17) % 2000,
    requestsThisMonth: (seed * 313) % 50000,
    webhookDeliveriesToday: (seed * 7) % 200,
    rateLimitRemaining: 1000 - ((seed * 17) % 1000),
    rateLimitTotal: 1000,
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    session: null,
    keys: [],
    usageStats: new Map(),
    isLoading: false,
    error: null,
  })

  const signIn = useCallback(async (email: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      // Simulate a magic-link / OAuth token exchange (replace with real fetch)
      await new Promise<void>((resolve) => setTimeout(resolve, 800))
      const session: DevSession = {
        token: crypto.randomUUID(),
        email,
        displayName: email.split('@')[0],
        expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8-hour session
      }
      // NOTE: session token is kept in memory only — never written to localStorage
      dispatch({ type: 'SET_SESSION', payload: session })
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Sign-in failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const signOut = useCallback(() => {
    dispatch({ type: 'SET_SESSION', payload: null })
  }, [])

  const createKey = useCallback(async (name: string): Promise<ApiKey> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      // Simulate an API call to create the key server-side
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
      const plain = generateKeyValue()
      const key: ApiKey = {
        id: crypto.randomUUID(),
        name,
        plaintextValue: plain, // shown ONCE; cleared when user calls acknowledgeKeyValue
        maskedValue: maskKeyValue(plain),
        status: 'active',
        createdAt: Date.now(),
        lastUsedAt: null,
        expiresAt: null,
      }
      dispatch({ type: 'ADD_KEY', payload: key })
      dispatch({ type: 'SET_USAGE', payload: simulatedUsage(key.id) })
      return key
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create API key.' })
      throw new Error('Failed to create API key.')
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const revokeKey = useCallback(async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 400))
      dispatch({ type: 'REVOKE_KEY', payload: id })
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to revoke key.' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  const renameKey = useCallback(async (id: string, newName: string) => {
    dispatch({ type: 'RENAME_KEY', payload: { id, name: newName } })
  }, [])

  const acknowledgeKeyValue = useCallback((id: string) => {
    dispatch({ type: 'ACKNOWLEDGE_KEY', payload: id })
  }, [])

  const value: ApiKeysContextType = {
    session: state.session,
    keys: state.keys,
    usageStats: state.usageStats,
    isLoading: state.isLoading,
    error: state.error,
    signIn,
    signOut,
    createKey,
    revokeKey,
    renameKey,
    acknowledgeKeyValue,
  }

  return <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>
}

export function useApiKeys(): ApiKeysContextType {
  const ctx = useContext(ApiKeysContext)
  if (!ctx) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider')
  }
  return ctx
}
