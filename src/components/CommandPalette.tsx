/**
 * CommandPalette — VS Code-style Cmd+K / Ctrl+K command palette.
 *
 * Opens as a full-screen modal overlay. The user can type to filter commands
 * and navigate with Arrow keys or the mouse. Enter executes the highlighted
 * command; Escape closes the palette.
 *
 * ## Command categories
 * - **Navigation** — go to Dashboard, Landing, API Docs, price detail pairs
 * - **Saved Views** — activate any view saved via `useSavedViews`
 *
 * ## Usage
 * ```tsx
 * const [open, setOpen] = useState(false)
 *
 * // Wire up Ctrl+K / Cmd+K
 * useEffect(() => {
 *   const handler = (e: KeyboardEvent) => {
 *     if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
 *       e.preventDefault()
 *       setOpen(true)
 *     }
 *   }
 *   window.addEventListener('keydown', handler)
 *   return () => window.removeEventListener('keydown', handler)
 * }, [])
 *
 * <CommandPalette isOpen={open} onClose={() => setOpen(false)} />
 * ```
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSavedViews } from '../hooks/useSavedViews'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommandCategory = 'Navigation' | 'Saved Views'

export interface Command {
  /** Unique stable identifier */
  id: string
  /** Display label shown in the palette */
  label: string
  /** Grouping label */
  category: CommandCategory
  /** Optional secondary hint / description */
  hint?: string
  /** Called when the user activates the command */
  handler: () => void
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Category icons ───────────────────────────────────────────────────────────

function NavIcon(): ReactElement {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  )
}

function ViewIcon(): ReactElement {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  )
}

function categoryIcon(category: CommandCategory): ReactElement {
  return category === 'Saved Views' ? <ViewIcon /> : <NavIcon />
}

const CATEGORY_COLORS: Record<CommandCategory, string> = {
  Navigation: 'text-sky-400',
  'Saved Views': 'text-indigo-400',
}

const CATEGORY_BG: Record<CommandCategory, string> = {
  Navigation: 'bg-sky-900/40 text-sky-300',
  'Saved Views': 'bg-indigo-900/40 text-indigo-300',
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
}: CommandPaletteProps): ReactElement | null {
  const navigate = useNavigate()
  const { views, activateView } = useSavedViews()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const activeItemRef = useRef<HTMLLIElement>(null)

  const inputId = useId()
  const listId = useId()

  // ── Build static navigation commands ─────────────────────────────────────
  const navCommands = useMemo<Command[]>(
    () => [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        hint: '/dashboard',
        handler: () => {
          navigate('/dashboard')
          onClose()
        },
      },
      {
        id: 'nav-home',
        label: 'Go to Home',
        category: 'Navigation',
        hint: '/',
        handler: () => {
          navigate('/')
          onClose()
        },
      },
      {
        id: 'nav-api-docs',
        label: 'Go to API Docs',
        category: 'Navigation',
        hint: '/api-docs',
        handler: () => {
          navigate('/api-docs')
          onClose()
        },
      },
    ],
    [navigate, onClose],
  )

  // ── Build saved-view commands ─────────────────────────────────────────────
  const viewCommands = useMemo<Command[]>(
    () =>
      views.map((view) => ({
        id: `view-${view.id}`,
        label: view.name,
        category: 'Saved Views' as const,
        hint: view.description,
        handler: () => {
          activateView(view.id)
          onClose()
        },
      })),
    [views, activateView, onClose],
  )

  // ── All commands, navigation first ───────────────────────────────────────
  const allCommands = useMemo(
    () => [...navCommands, ...viewCommands],
    [navCommands, viewCommands],
  )

  // ── Filter by query ───────────────────────────────────────────────────────
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCommands
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        (cmd.hint ?? '').toLowerCase().includes(q),
    )
  }, [allCommands, query])

  // ── Reset state on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      // Delay focus to allow portal to mount
      const id = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(id)
    }
    return undefined
  }, [isOpen])

  // ── Clamp active index when filtered list changes ─────────────────────────
  useEffect(() => {
    setActiveIndex((prev) =>
      filteredCommands.length === 0
        ? 0
        : Math.min(prev, filteredCommands.length - 1),
    )
  }, [filteredCommands.length])

  // ── Scroll active item into view ──────────────────────────────────────────
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // ── Close on Escape (global handler to catch it before anything else) ─────
  useEffect(() => {
    if (!isOpen) return
    function handler(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [isOpen, onClose])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setActiveIndex(0)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (filteredCommands.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(
          (prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filteredCommands[activeIndex]
        cmd?.handler()
      }
    },
    [filteredCommands, activeIndex],
  )

  const handleBackdropClick = useCallback(() => {
    onClose()
  }, [onClose])

  // ── Group commands by category for display ────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<CommandCategory, Command[]>()
    for (const cmd of filteredCommands) {
      const existing = map.get(cmd.category) ?? []
      map.set(cmd.category, [...existing, cmd])
    }
    return map
  }, [filteredCommands])

  if (!isOpen) return null

  // Get a flat sorted list index for a command (for aria-activedescendant and
  // highlight detection)
  function getIndex(cmd: Command): number {
    return filteredCommands.indexOf(cmd)
  }

  const palette = (
    // Backdrop
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onClick={handleBackdropClick}
    >
      {/* Dim overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        aria-labelledby={inputId}
        className="relative w-full max-w-xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          {/* Search icon */}
          <svg
            className="w-4 h-4 text-gray-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={
              filteredCommands.length > 0
                ? `cmd-item-${filteredCommands[activeIndex]?.id}`
                : undefined
            }
            aria-expanded={filteredCommands.length > 0}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Hint badge */}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-800 border border-gray-700 rounded text-gray-400">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No commands match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Commands"
              className="py-2"
            >
              {Array.from(grouped.entries()).map(([category, cmds]) => (
                <li key={category} role="presentation">
                  {/* Category header */}
                  <p
                    className={`px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase ${CATEGORY_COLORS[category]}`}
                    role="presentation"
                  >
                    {category}
                  </p>

                  {/* Command items */}
                  <ul role="presentation">
                    {cmds.map((cmd) => {
                      const flatIdx = getIndex(cmd)
                      const isActive = flatIdx === activeIndex
                      return (
                        <li
                          key={cmd.id}
                          id={`cmd-item-${cmd.id}`}
                          ref={isActive ? activeItemRef : undefined}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => cmd.handler()}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-gray-700/70 text-gray-100'
                              : 'text-gray-300 hover:bg-gray-800/60'
                          }`}
                        >
                          {/* Category chip */}
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${CATEGORY_BG[category]}`}
                            aria-hidden="true"
                          >
                            {categoryIcon(category)}
                          </span>

                          {/* Label */}
                          <span className="flex-1 text-sm truncate">{cmd.label}</span>

                          {/* Hint / path */}
                          {cmd.hint && (
                            <span className="text-xs text-gray-500 truncate max-w-[8rem]" aria-label={`hint: ${cmd.hint}`}>
                              {cmd.hint}
                            </span>
                          )}

                          {/* ↵ indicator when active */}
                          {isActive && (
                            <kbd
                              className="shrink-0 inline-flex items-center px-1 py-0.5 text-[10px] font-mono bg-gray-700 border border-gray-600 rounded text-gray-400"
                              aria-hidden="true"
                            >
                              ↵
                            </kbd>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-800 text-[11px] text-gray-500">
          <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono">↵</kbd> Execute</span>
          <span><kbd className="font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )

  return createPortal(palette, document.body)
})
