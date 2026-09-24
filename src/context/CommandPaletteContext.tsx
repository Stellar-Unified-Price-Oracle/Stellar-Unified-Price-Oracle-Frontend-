/**
 * Owns the command palette's open state and the global Ctrl/Cmd+K shortcut.
 *
 * Must be rendered inside the router (app-level commands navigate) and inside
 * `CommandRegistryProvider` (it registers those commands and renders the
 * palette). {@link useCommandPalette} is tolerant of a missing provider so
 * components such as `Layout` render in isolation during tests.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CommandPalette } from '../components/CommandPalette'
import { useAppCommands } from '../hooks/useAppCommands'

interface CommandPaletteValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null)

const NOOP = () => {}
const FALLBACK: CommandPaletteValue = { isOpen: false, open: NOOP, close: NOOP, toggle: NOOP }

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  // App-wide commands: navigation, theme, saved views.
  useAppCommands()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey) return
      // Ctrl+K / Cmd+K works even while an input is focused — it is a chord,
      // not a bare key, so it cannot be confused with typing.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggle()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  const value = useMemo<CommandPaletteValue>(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  )
}

/** Returns the palette controls. Outside the provider it is an inert no-op. */
export function useCommandPalette(): CommandPaletteValue {
  return useContext(CommandPaletteContext) ?? FALLBACK
}
