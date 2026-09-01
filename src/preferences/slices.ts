/**
 * Sub-reducers for the preference system, one per concern.
 *
 * `Preferences` is stored flat, but each key is *owned* by exactly one slice. An action
 * is offered to each slice reducer in turn; the owner applies it and every other slice
 * returns its input unchanged (by reference), so an update can never touch a key
 * outside the slice that owns it.
 *
 * Adding a preference category means adding a key list and a reducer here — no existing
 * slice is edited. Adding a key to an existing category means adding it to that slice's
 * key list; `_allKeysOwned` below fails the build if a key is left unassigned.
 *
 * Each slice reducer is a plain function over plain data, so it can be tested on its own
 * without React, context, or the undo/redo stack.
 */

import type { Preferences } from './types'

/** Sets a single preference key to a new value. */
export type SetPreferenceAction = {
  [K in keyof Preferences]-?: { type: 'set'; key: K; value: Preferences[K] }
}[keyof Preferences]

/**
 * Builds a {@link SetPreferenceAction}.
 *
 * The cast is the one place the per-key generic is widened to the union: TypeScript
 * cannot prove `{ key: K; value: Preferences[K] }` inhabits the union for an unresolved
 * `K`, even though it does for every concrete `K`.
 */
export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): SetPreferenceAction {
  return { type: 'set', key, value } as SetPreferenceAction
}

/**
 * Reduces the whole `Preferences` object but only reacts to keys it owns.
 * Returns its input unchanged — same reference — for any other key.
 */
export type PreferencesSliceReducer = (state: Preferences, action: SetPreferenceAction) => Preferences

function createSliceReducer<K extends keyof Preferences>(ownedKeys: readonly K[]): PreferencesSliceReducer {
  const owned = new Set<string>(ownedKeys)
  return (state, action) => {
    if (!owned.has(action.key)) return state
    if (Object.is(state[action.key], action.value)) return state
    return { ...state, [action.key]: action.value }
  }
}

export const DATA_PREFERENCE_KEYS = [
  'refreshInterval',
  'chartTimeRange',
  'staleThresholdMinutes',
  'sourcePriority',
  'onChainDivergenceThresholdPercent',
] as const
export const LAYOUT_PREFERENCE_KEYS = ['dashboardView', 'cardOrder'] as const
export const ACCESSIBILITY_PREFERENCE_KEYS = ['reducedMotion', 'highContrast', 'largeText', 'rtlEnabled'] as const
export const PRIVACY_PREFERENCE_KEYS = ['analyticsOptOut', 'chartTimezone'] as const

/** Handles refresh cadence, chart window, and staleness threshold. */
export const dataPreferencesReducer = createSliceReducer(DATA_PREFERENCE_KEYS)

/** Handles dashboard view mode and card ordering. */
export const layoutPreferencesReducer = createSliceReducer(LAYOUT_PREFERENCE_KEYS)

/** Handles reduced motion, high contrast, and large text. */
export const accessibilityPreferencesReducer = createSliceReducer(ACCESSIBILITY_PREFERENCE_KEYS)

/** Handles the analytics opt-out. */
export const privacyPreferencesReducer = createSliceReducer(PRIVACY_PREFERENCE_KEYS)

const SLICE_REDUCERS: readonly PreferencesSliceReducer[] = [
  dataPreferencesReducer,
  layoutPreferencesReducer,
  accessibilityPreferencesReducer,
  privacyPreferencesReducer,
]

type OwnedPreferenceKey =
  | (typeof DATA_PREFERENCE_KEYS)[number]
  | (typeof LAYOUT_PREFERENCE_KEYS)[number]
  | (typeof ACCESSIBILITY_PREFERENCE_KEYS)[number]
  | (typeof PRIVACY_PREFERENCE_KEYS)[number]

type AssertNever<T extends never> = T

/**
 * Compile-time guard: every key of `Preferences` must be claimed by a slice above.
 * Adding a preference without assigning it to a slice leaves a key in the `Exclude`,
 * which violates the `extends never` constraint and fails the build.
 */
export type AllPreferenceKeysOwned = AssertNever<Exclude<keyof Preferences, OwnedPreferenceKey>>

/**
 * Routes an action to the slice that owns its key.
 *
 * Returns `state` unchanged when no slice claims the key or when the value is already
 * set, so callers can use reference equality to detect a real change.
 */
export function preferencesReducer(state: Preferences, action: SetPreferenceAction): Preferences {
  for (const reduce of SLICE_REDUCERS) {
    const next = reduce(state, action)
    if (next !== state) return next
  }
  return state
}
