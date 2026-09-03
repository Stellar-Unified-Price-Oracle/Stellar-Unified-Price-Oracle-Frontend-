import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { applyRtl } from '../i18n'
import i18n from '../i18n'
import { useUndoRedo, type Command } from '../hooks/useUndoRedo'
import { idbCache } from '../hooks/useIndexedDB'
import { createBroadcastChannel } from '../utils/broadcastChannel'
import { DEFAULT_PREFERENCES, MAX_UNDO_DEPTH } from './constants'
import { preferencesReducer, setPreference } from './slices'
import type { Preferences } from './types'

const PREFS_IDB_KEY = 'user-preferences'
const prefsChannel = createBroadcastChannel<Preferences>('kiro-preferences')

interface PreferencesContextValue {
  preferences: Preferences
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const [idbLoaded, setIdbLoaded] = useState(false)

  const {
    state: preferences,
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    reset,
  } = useUndoRedo<Preferences>(DEFAULT_PREFERENCES, MAX_UNDO_DEPTH)

  // Load persisted preferences from IndexedDB on mount. `reset` (rather than
  // the initial state passed to useUndoRedo) is required here since that
  // initial value is only ever read on the very first render — by the time
  // this async load resolves, useUndoRedo's own state already exists and
  // won't re-sync to a later change in the value it was constructed with.
  useEffect(() => {
    idbCache.get<Preferences>('preferences', PREFS_IDB_KEY, Infinity).then((saved) => {
      if (saved) reset({ ...DEFAULT_PREFERENCES, ...saved })
      setIdbLoaded(true)
    })
  }, [reset])

  // Persist to IndexedDB whenever preferences change
  useEffect(() => {
    if (idbLoaded) {
      idbCache.set('preferences', PREFS_IDB_KEY, preferences)
      // Broadcast preferences change to other tabs
      prefsChannel.broadcast('preferences-update', preferences)
    }
  }, [preferences, idbLoaded])

  // Keep <html dir="rtl|ltr"> in sync with the rtlEnabled preference override.
  // When rtlEnabled is true we force RTL regardless of the active language;
  // when false we let the language code decide (passing undefined).
  useEffect(() => {
    applyRtl(i18n.language, preferences.rtlEnabled || undefined)
  }, [preferences.rtlEnabled])

  const updatePreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      const previousValue = preferences[key]
      if (previousValue === value) return

      // Both directions go through the slice reducers, so an update can only ever
      // touch the slice that owns `key`.
      const command: Command<Preferences> = {
        apply: (s) => preferencesReducer(s, setPreference(key, value)),
        undo: (s) => preferencesReducer(s, setPreference(key, previousValue)),
        description: `${key}: ${previousValue} → ${value}`,
      }
      execute(command)
    },
    [preferences, execute],
  )

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      clear()
      prevPathRef.current = location.pathname
    }
  }, [location.pathname, clear])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCtrlZ = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey
      const isCtrlShiftZ = (e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey

      if (isCtrlZ) {
        e.preventDefault()
        undo()
      }
      if (isCtrlShiftZ) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return (
    <PreferencesContext.Provider
      value={{ preferences, updatePreference, undo, redo, canUndo, canRedo, clearHistory: clear }}
    >
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
