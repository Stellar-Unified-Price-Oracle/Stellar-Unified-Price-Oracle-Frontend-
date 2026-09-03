/**
 * featureFlags.ts
 *
 * Minimal feature flag system (#359):
 * - Flags are defined in {@link FEATURE_FLAGS} below.
 * - Toggle any flag from an environment variable by setting
 *   `VITE_FLAG_<KEY_IN_SCREAMING_SNAKE_CASE>` to `'true'` or `'false'` — this
 *   always wins over rollout percentage and default state, so it doubles as
 *   a kill switch.
 * - `rolloutPercentage` (0-100) assigns browsers to a sticky bucket so the
 *   same browser always gets the same result across sessions.
 * - In development, flags can be toggled at runtime from the browser console
 *   via `window.__featureFlags` (list / override / clear).
 */

import { STORAGE_KEYS, readRaw, writeRaw } from '../utils/storage'
import { trackEvent } from '../hooks/useAnalytics'

/** Definition for a single feature flag. */
export interface FeatureFlagDefinition {
  /** What the flag controls, for maintainers reading this file. */
  description: string
  /** State used when there is no env override and no rollout percentage applies. */
  defaultEnabled: boolean
  /**
   * 0-100. When set, a sticky per-browser bucket (not `defaultEnabled`) decides
   * membership: browsers in the bucket see the flag on, others see it off.
   */
  rolloutPercentage?: number
}

/**
 * Feature flag definitions. Add an entry here to make a flag available to
 * {@link isFeatureEnabled} and `useFeatureFlag`.
 */
export const FEATURE_FLAGS = {
  /** Console + analytics reporting when JS heap usage exceeds the memory threshold (#322). */
  memoryWarningReporting: {
    description: 'Report a warning when JS heap usage exceeds the memory threshold.',
    defaultEnabled: true,
  },
} as const satisfies Record<string, FeatureFlagDefinition>

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

function envVarName(key: string): string {
  const screaming = key.replace(/([A-Z])/g, '_$1').toUpperCase()
  return `VITE_FLAG_${screaming}`
}

function envOverride(key: string): boolean | null {
  const raw = (import.meta.env as Record<string, string | undefined>)[envVarName(key)]
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

// ---------------------------------------------------------------------------
// Sticky rollout bucket — persisted so percentage rollout is stable across
// sessions for the same browser.
// ---------------------------------------------------------------------------

let cachedBucketId: string | null = null

function getBucketId(): string {
  if (cachedBucketId) return cachedBucketId
  const stored = readRaw(STORAGE_KEYS.featureFlagBucket)
  if (stored) {
    cachedBucketId = stored
    return cachedBucketId
  }
  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  writeRaw(STORAGE_KEYS.featureFlagBucket, generated)
  cachedBucketId = generated
  return cachedBucketId
}

/** Deterministic string hash (djb2), mapped into [0, 100). Exported for unit testing. */
export function hashToPercent(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return Math.abs(hash) % 100
}

// ---------------------------------------------------------------------------
// Dev-only manual overrides (browser console admin panel, #359)
// ---------------------------------------------------------------------------

const devOverrides = new Map<string, boolean>()
const overrideSubscribers = new Set<() => void>()

/** Subscribes to dev-console override changes. Returns an unsubscribe function. */
export function subscribeFeatureFlagOverrides(listener: () => void): () => void {
  overrideSubscribers.add(listener)
  return () => overrideSubscribers.delete(listener)
}

type WindowWithFeatureFlags = Window & {
  __featureFlags?: {
    list: () => Record<string, boolean>
    override: (key: string, value: boolean) => void
    clear: (key?: string) => void
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as WindowWithFeatureFlags
  w.__featureFlags = {
    list: () =>
      Object.fromEntries(
        (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => [key, isFeatureEnabled(key)]),
      ),
    override: (key, value) => {
      devOverrides.set(key, value)
      overrideSubscribers.forEach((fn) => fn())
    },
    clear: (key) => {
      if (key) devOverrides.delete(key)
      else devOverrides.clear()
      overrideSubscribers.forEach((fn) => fn())
    },
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const loggedFlags = new Set<string>()

/**
 * Evaluates whether a feature flag is enabled. Precedence: dev console
 * override (`window.__featureFlags.override`) > `VITE_FLAG_*` env var >
 * percentage rollout (sticky per browser) > `defaultEnabled`.
 *
 * Logs the first evaluation of each flag per session via analytics.
 *
 * @example
 * ```ts
 * if (isFeatureEnabled('memoryWarningReporting')) {
 *   reportMemoryWarning()
 * }
 * ```
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const definition = FEATURE_FLAGS[key]

  let enabled: boolean
  if (devOverrides.has(key)) {
    enabled = devOverrides.get(key)!
  } else {
    const override = envOverride(key)
    if (override !== null) {
      enabled = override
    } else if (definition.rolloutPercentage !== undefined) {
      enabled = hashToPercent(`${getBucketId()}:${key}`) < definition.rolloutPercentage
    } else {
      enabled = definition.defaultEnabled
    }
  }

  if (!loggedFlags.has(key)) {
    loggedFlags.add(key)
    trackEvent('feature_flag:evaluated', { flag: key, enabled })
  }

  return enabled
}
