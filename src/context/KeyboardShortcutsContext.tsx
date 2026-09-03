import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useKeyboardShortcuts, type ShortcutDefinition } from '../hooks/useKeyboardShortcuts'
import { KeyboardShortcutHelp } from '../components/KeyboardShortcutHelp'

interface KeyboardShortcutsContextValue {
  /** Whether the shortcut help overlay is open */
  helpOpen: boolean
  /** Open the help overlay */
  openHelp: () => void
  /** Close the help overlay */
  closeHelp: () => void
  /** All registered shortcuts (for display in the help overlay) */
  shortcuts: ShortcutDefinition[]
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

export function useKeyboardShortcutsContext(): KeyboardShortcutsContextValue {
  const ctx = useContext(KeyboardShortcutsContext)
  if (!ctx) throw new Error('useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider')
  return ctx
}

/**
 * Provides app-wide keyboard shortcuts and a help overlay.
 * Must be rendered inside BrowserRouter so useNavigate works.
 */
export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)

  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])

  const shortcuts = useMemo<ShortcutDefinition[]>(
    () => [
      // ── Navigation ──────────────────────────────────────────────────
      {
        keys: 'g d',
        description: 'Go to Dashboard',
        category: 'Navigation',
        handler: () => navigate('/'),
      },
      {
        keys: 'g a',
        description: 'Go to API Docs',
        category: 'Navigation',
        handler: () => navigate('/api-docs'),
      },

      // ── Search / Focus ───────────────────────────────────────────────
      {
        keys: '/',
        description: 'Focus search bar',
        category: 'Search',
        handler: () => {
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]',
          )
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
        },
      },
      {
        keys: 'Escape',
        description: 'Clear focus / close modals',
        category: 'Search',
        handler: () => {
          const el = document.activeElement as HTMLElement | null
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            el.blur()
          }
        },
        ignoreInputs: true,
      },

      // ── View toggles ─────────────────────────────────────────────────
      {
        keys: 'v c',
        description: 'Switch to Card view',
        category: 'View',
        handler: () => {
          const btn = document.querySelector<HTMLButtonElement>('[aria-label="Card view"]')
          btn?.click()
        },
      },
      {
        keys: 'v t',
        description: 'Switch to Table view',
        category: 'View',
        handler: () => {
          const btn = document.querySelector<HTMLButtonElement>('[aria-label="Table view"]')
          btn?.click()
        },
      },

      // ── Panels ───────────────────────────────────────────────────────
      {
        keys: 'a',
        description: 'Toggle alerts panel',
        category: 'Panels',
        handler: () => {
          const btn = document.querySelector<HTMLButtonElement>('[aria-label*="alerts" i], [aria-label*="Alerts" i]')
          btn?.click()
        },
      },
      {
        keys: 'f',
        description: 'Toggle filter panel',
        category: 'Panels',
        handler: () => {
          const btn = document.querySelector<HTMLButtonElement>('[aria-label*="filter" i], [aria-label*="Filter" i]')
          btn?.click()
        },
      },

      // ── Help ─────────────────────────────────────────────────────────
      {
        keys: '?',
        description: 'Show keyboard shortcut help',
        category: 'Help',
        handler: () => setHelpOpen((prev) => !prev),
      },
    ],
    [navigate],
  )

  useKeyboardShortcuts(shortcuts)

  const value = useMemo<KeyboardShortcutsContextValue>(
    () => ({ helpOpen, openHelp, closeHelp, shortcuts }),
    [helpOpen, openHelp, closeHelp, shortcuts],
  )

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      {helpOpen && (
        <KeyboardShortcutHelp shortcuts={shortcuts} onClose={closeHelp} />
      )}
    </KeyboardShortcutsContext.Provider>
  )
}
