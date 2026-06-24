import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { fetchFeatureFlags } from '../api/flags'
import type { FeatureFlag, FeatureFlagsContextValue } from './types'

const OVERRIDE_KEY = 'feature-flag-overrides'

function loadOverrides(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(OVERRIDE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveOverrides(overrides: Record<string, boolean>) {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides))
  } catch {
    // ignore storage errors
  }
}

function parseEnvFlags(): FeatureFlag[] {
  const flags: FeatureFlag[] = []
  for (const [key, value] of Object.entries(import.meta.env)) {
    if (key.startsWith('VITE_FEATURE_')) {
      const name = key.replace('VITE_FEATURE_', '').toLowerCase().replace(/_/g, '-')
      flags.push({
        name,
        description: `Local flag from ${key}`,
        defaultValue: value === 'true',
        enabled: value === 'true',
        source: 'local',
      })
    }
  }
  return flags
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overridesRef = useRef<Record<string, boolean>>(loadOverrides())
  const mountedRef = useRef(true)

  const buildFlags = (remoteFlags: FeatureFlag[] = []) => {
    const envFlags = parseEnvFlags()
    const allFlags: FeatureFlag[] = []

    for (const envFlag of envFlags) {
      const remoteMatch = remoteFlags.find((f) => f.name === envFlag.name)
      if (remoteMatch) {
        allFlags.push({ ...remoteMatch, source: 'local' })
      } else {
        allFlags.push(envFlag)
      }
    }

    for (const remoteFlag of remoteFlags) {
      if (!envFlags.some((f) => f.name === remoteFlag.name)) {
        allFlags.push(remoteFlag)
      }
    }

    const overrides = overridesRef.current
    return allFlags.reduce<Record<string, FeatureFlag>>((acc, flag) => {
      const overrideValue = overrides[flag.name]
      acc[flag.name] = {
        ...flag,
        enabled: overrideValue !== undefined ? overrideValue : flag.enabled,
        source: overrideValue !== undefined ? 'override' : flag.source,
      }
      return acc
    }, {})
  }

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return
    setLoading(true)
    setError(null)
    try {
      const remoteFlags = await fetchFeatureFlags()
      if (mountedRef.current) {
        setFlags(buildFlags(remoteFlags))
      }
    } catch (e) {
      if (mountedRef.current) {
        setFlags(buildFlags())
        setError(e instanceof Error ? e.message : 'Failed to load feature flags')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const override = (name: string, value: boolean) => {
    const newOverrides = { ...overridesRef.current, [name]: value }
    overridesRef.current = newOverrides
    saveOverrides(newOverrides)
    setFlags(buildFlags())
  }

  const clearOverride = (name: string) => {
    const newOverrides = { ...overridesRef.current }
    delete newOverrides[name]
    overridesRef.current = newOverrides
    saveOverrides(newOverrides)
    setFlags(buildFlags())
  }

  const clearAllOverrides = () => {
    overridesRef.current = {}
    saveOverrides({})
    setFlags(buildFlags())
  }

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  const value: FeatureFlagsContextValue = {
    flags,
    loading,
    error,
    refresh,
    override,
    clearOverride,
    clearAllOverrides,
  }

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider')
  }
  return ctx
}

export function useFeatureFlag(name: string): boolean {
  const { flags, loading } = useFeatureFlags()
  if (loading) return false
  return flags[name]?.enabled ?? false
}