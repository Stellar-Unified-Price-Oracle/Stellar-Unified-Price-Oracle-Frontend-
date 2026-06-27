import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useUndoRedo, type Command } from '../hooks/useUndoRedo'
import { DEFAULT_PREFERENCES, MAX_UNDO_DEPTH } from './constants'
import { idbCache } from '../hooks/useIndexedDB'
import type { Preferences } from './types'

const PREFS_IDB_KEY = 'user-preferences'

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
  const [initialPrefs, setInitialPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [idbLoaded, setIdbLoaded] = useState(false)

  // Load persisted preferences from IndexedDB on mount
  useEffect(() => {
    idbCache.get<Preferences>('preferences', PREFS_IDB_KEY, Infinity).then((saved) => {
      if (saved) setInitialPrefs({ ...DEFAULT_PREFERENCES, ...saved })
      setIdbLoaded(true)
    })
  }, [])

  const {
    state: preferences,
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  } = useUndoRedo<Preferences>(initialPrefs, MAX_UNDO_DEPTH)

  // Persist to IndexedDB whenever preferences change
  useEffect(() => {
    if (idbLoaded) {
      idbCache.set('preferences', PREFS_IDB_KEY, preferences)
    }
  }, [preferences, idbLoaded])

  const updatePreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      const previousValue = preferences[key]
      if (previousValue === value) return

      const command: Command<Preferences> = {
        apply: (s) => ({ ...s, [key]: value }),
        undo: (s) => ({ ...s, [key]: previousValue }),
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
