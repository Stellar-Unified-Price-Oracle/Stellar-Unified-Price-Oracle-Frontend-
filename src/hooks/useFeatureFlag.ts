import { useEffect, useState } from 'react'
import {
  isFeatureEnabled,
  subscribeFeatureFlagOverrides,
  type FeatureFlagKey,
} from '../config/featureFlags'

/**
 * Returns whether a feature flag is currently enabled (#359), re-evaluating
 * when a dev-console override changes (see `window.__featureFlags` in
 * development).
 *
 * @param key - Flag key from {@link FEATURE_FLAGS}.
 * @returns `true` when the flag is enabled for this browser.
 *
 * @example
 * ```ts
 * const memoryWarningsEnabled = useFeatureFlag('memoryWarningReporting')
 * ```
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(key))

  useEffect(() => {
    setEnabled(isFeatureEnabled(key))
    return subscribeFeatureFlagOverrides(() => setEnabled(isFeatureEnabled(key)))
  }, [key])

  return enabled
}
