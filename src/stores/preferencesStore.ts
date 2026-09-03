import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PREFERENCES } from '../preferences/constants'
import { preferencesReducer, setPreference } from '../preferences/slices'
import type { Preferences } from '../preferences/types'

/**
 * Zustand store for user preferences.
 *
 * Replaces the context-based state in PreferencesContext so that individual
 * components can subscribe only to the preference keys they need, preventing
 * the full re-renders that context triggers.
 *
 * Undo/redo history is kept here alongside the preference values so the full
 * preferences system is self-contained in one store.
 */
export interface PreferencesState {
  preferences: Preferences
  history: Preferences[]
  future: Preferences[]

  // Actions
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
  canUndo: boolean
  canRedo: boolean
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      history: [],
      future: [],
      canUndo: false,
      canRedo: false,

      updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]): void => {
        const { preferences, history } = get()
        if (preferences[key] === value) return

        const next = preferencesReducer(preferences, setPreference(key, value))
        set({
          preferences: next,
          history: [...history, preferences],
          future: [],
          canUndo: true,
          canRedo: false,
        })
      },

      undo: (): void => {
        const { history, preferences, future } = get()
        if (history.length === 0) return
        const prev = history[history.length - 1]
        set({
          preferences: prev,
          history: history.slice(0, -1),
          future: [preferences, ...future],
          canUndo: history.length > 1,
          canRedo: true,
        })
      },

      redo: (): void => {
        const { future, preferences, history } = get()
        if (future.length === 0) return
        const next = future[0]
        set({
          preferences: next,
          history: [...history, preferences],
          future: future.slice(1),
          canUndo: true,
          canRedo: future.length > 1,
        })
      },

      clearHistory: (): void => {
        set({ history: [], future: [], canUndo: false, canRedo: false })
      },
    }),
    {
      name: 'stellar-oracle-preferences',
      // Only persist the preferences values, not the undo/redo history.
      partialize: (state) => ({ preferences: state.preferences }),
    },
  ),
)
