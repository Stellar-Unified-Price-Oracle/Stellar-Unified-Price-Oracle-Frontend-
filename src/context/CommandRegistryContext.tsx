/**
 * Command registry.
 *
 * Features (navigation, filters, alerts, exports, theme, saved views, …) push
 * their own commands into a single registry via {@link useRegisterCommands}.
 * Registration is keyed by an owner id (derived from `useId`), so re-registering
 * replaces that owner's previous commands and unmounting removes them.
 *
 * The registry intentionally holds no UI: `CommandPalette` reads the flat list
 * through {@link useCommands}, and `CommandPaletteProvider` owns open state.
 *
 * Both hooks are deliberately tolerant of a missing provider so components that
 * register commands can still render in isolation (unit tests, Storybook)
 * without wrapping the tree in the provider.
 */

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { Command } from '../types/commands'

interface CommandRegistryValue {
  /** All registered commands, deduplicated by id (first registration wins). */
  commands: Command[]
  registerCommands: (ownerId: string, commands: Command[]) => void
  unregisterCommands: (ownerId: string) => void
}

const CommandRegistryContext = createContext<CommandRegistryValue | null>(null)

const NO_COMMANDS: Command[] = []

export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  // ownerId -> commands. Keeping a per-owner map means one feature re-registering
  // never rebuilds another feature's entries.
  const [registry, setRegistry] = useState<Map<string, Command[]>>(() => new Map())

  const registerCommands = useCallback((ownerId: string, next: Command[]) => {
    setRegistry((prev) => {
      const existing = prev.get(ownerId)
      // Same array reference (or element-wise identical) — no state change.
      if (existing && existing.length === next.length && existing.every((c, i) => c === next[i])) {
        return prev
      }
      const updated = new Map(prev)
      updated.set(ownerId, next)
      return updated
    })
  }, [])

  const unregisterCommands = useCallback((ownerId: string) => {
    setRegistry((prev) => {
      if (!prev.has(ownerId)) return prev
      const updated = new Map(prev)
      updated.delete(ownerId)
      return updated
    })
  }, [])

  const commands = useMemo(() => {
    const byId = new Map<string, Command>()
    for (const list of registry.values()) {
      for (const command of list) {
        if (!byId.has(command.id)) byId.set(command.id, command)
      }
    }
    return [...byId.values()]
  }, [registry])

  const value = useMemo(
    () => ({ commands, registerCommands, unregisterCommands }),
    [commands, registerCommands, unregisterCommands],
  )

  return <CommandRegistryContext.Provider value={value}>{children}</CommandRegistryContext.Provider>
}

/** Returns every registered command. Returns an empty list outside the provider. */
export function useCommands(): Command[] {
  return useContext(CommandRegistryContext)?.commands ?? NO_COMMANDS
}

/**
 * Registers `commands` for the lifetime of the calling component (plus whenever
 * the `commands` array identity changes). Callers must memoize the array —
 * otherwise the effect re-runs every render and churns the registry, which is
 * especially costly for large sets such as one command per price pair.
 */
export function useRegisterCommands(commands: Command[]): void {
  const context = useContext(CommandRegistryContext)
  const registerCommands = context?.registerCommands
  const unregisterCommands = context?.unregisterCommands
  const ownerId = useId()

  useEffect(() => {
    if (!registerCommands || !unregisterCommands) return undefined
    registerCommands(ownerId, commands)
    return () => unregisterCommands(ownerId)
  }, [ownerId, commands, registerCommands, unregisterCommands])
}
