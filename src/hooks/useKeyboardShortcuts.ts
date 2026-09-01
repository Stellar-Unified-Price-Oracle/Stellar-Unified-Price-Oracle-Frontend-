import { useEffect, useCallback, useRef } from 'react'

export interface ShortcutDefinition {
  /** Key combination string, e.g. 'g d', 'ctrl+k', '/', 'Escape' */
  keys: string
  /** Human-readable description shown in the help overlay */
  description: string
  /** Category for grouping in the help overlay */
  category?: string
  /** Callback to invoke when the shortcut fires */
  handler: () => void
  /** If true, fires even when an input/textarea/select is focused */
  ignoreInputs?: boolean
}

interface ParsedShortcut {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

function parseShortcut(keys: string): ParsedShortcut {
  const parts = keys.toLowerCase().split('+')
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: parts[parts.length - 1],
  }
}

function matchesShortcut(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
  const key = e.key.toLowerCase()
  return (
    key === parsed.key &&
    e.ctrlKey === parsed.ctrl &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt &&
    e.metaKey === parsed.meta
  )
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  )
}

/**
 * Registers keyboard shortcuts globally (on `document`).
 * Pass `ignoreInputs: true` for shortcuts that should fire even while typing.
 *
 * Sequences (space-separated keys): 'g d' means press G then D within 1 s.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  // Track sequence state: last key pressed and when
  const sequenceRef = useRef<{ key: string; time: number } | null>(null)

  const handle = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (isInputFocused() && !shortcut.ignoreInputs) continue

        const parts = shortcut.keys.trim().split(' ')

        if (parts.length === 2) {
          // Two-key sequence (e.g. 'g d')
          const [first, second] = parts
          const now = Date.now()
          const parsed2 = parseShortcut(second)

          if (
            sequenceRef.current &&
            sequenceRef.current.key === first.toLowerCase() &&
            now - sequenceRef.current.time < 1000 &&
            matchesShortcut(e, parsed2)
          ) {
            e.preventDefault()
            sequenceRef.current = null
            shortcut.handler()
            return
          }

          const parsed1 = parseShortcut(first)
          if (matchesShortcut(e, parsed1)) {
            sequenceRef.current = { key: first.toLowerCase(), time: Date.now() }
          }
        } else {
          // Single key
          const parsed = parseShortcut(shortcut.keys.trim())
          if (matchesShortcut(e, parsed)) {
            e.preventDefault()
            shortcut.handler()
            return
          }
        }
      }
    },
    [shortcuts],
  )

  useEffect(() => {
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [handle])
}
