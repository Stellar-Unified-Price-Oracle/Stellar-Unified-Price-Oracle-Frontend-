export interface FeatureFlag {
  name: string
  description: string
  defaultValue: boolean
  enabled: boolean
  source: 'local' | 'remote' | 'override'
}

export interface FeatureFlagConfig {
  [key: string]: FeatureFlag
}

export interface FeatureFlagsState {
  flags: FeatureFlagConfig
  loading: boolean
  error: string | null
}

export interface FeatureFlagsActions {
  refresh: () => Promise<void>
  override: (name: string, value: boolean) => void
  clearOverride: (name: string) => void
  clearAllOverrides: () => void
}

export type FeatureFlagsContextValue = FeatureFlagsState & FeatureFlagsActions