/**
 * CommandPalette — a fuzzy-searchable command palette (Ctrl/Cmd+K).
 *
 * Commands are not hardcoded here: they arrive from the command registry, where
 * each feature registers the actions it owns (`useRegisterCommands`). This
 * component is the presentation + interaction layer.
 *
 * ## Scale
 *
 * The palette must stay responsive with thousands of commands (one per price
 * pair). To that end:
 *  - matching runs against a query deferred with `useDeferredValue`, so typing
 *    never blocks on scoring;
 *  - {@link rankByFuzzy} is O(candidates × label length) and allocates nothing
 *    per item beyond the result records;
 *  - the list is windowed with `@tanstack/react-virtual` above
 *    {@link VIRTUALIZE_THRESHOLD} rows, so only visible rows mount.
 *
 * ## Interaction
 *
 * Arrow keys / PageUp / PageDown / Home / End move the active row, Enter runs
 * it, Escape closes. The active row is tracked with the ARIA
 * `aria-activedescendant` pattern (focus stays in the input), and Tab is trapped
 * inside the dialog.
 */

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCommands } from '../context/CommandRegistryContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { COMMAND_CATEGORY_ORDER, type Command, type CommandCategory } from '../types/commands'
import { rankByFuzzy, type RankedItem } from '../utils/fuzzy'
import { sanitizeSearchInput } from '../utils/sanitize'

const ITEM_HEIGHT_PX = 40
const HEADER_HEIGHT_PX = 28
const OVERSCAN_ROWS = 12
const VIRTUALIZE_THRESHOLD = 60
const LIST_MAX_HEIGHT_PX = 320
const PAGE_STEP = 10

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface CommandEntry {
  command: Command
  score: number
  indices: number[]
  /** Index of this command's row in the flattened row list. */
  rowIndex: number
}

type Row = { kind: 'header'; key: string; category: CommandCategory } | { kind: 'item'; key: string; index: number }

const CATEGORY_ICON_PATH: Record<CommandCategory, string> = {
  navigation:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  pricePairs: 'M3 6l4 6 4-9 4 12 4-6 2 3M3 20h18',
  filters:
    'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  alerts:
    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  exports:
    'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  theme:
    'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  savedViews: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
}

const CATEGORY_ACCENT: Record<CommandCategory, string> = {
  navigation: 'text-sky-400',
  pricePairs: 'text-emerald-400',
  filters: 'text-amber-400',
  alerts: 'text-rose-400',
  exports: 'text-violet-400',
  theme: 'text-fuchsia-400',
  savedViews: 'text-indigo-400',
}

const CATEGORY_CHIP: Record<CommandCategory, string> = {
  navigation: 'bg-sky-500/15 text-sky-300',
  pricePairs: 'bg-emerald-500/15 text-emerald-300',
  filters: 'bg-amber-500/15 text-amber-300',
  alerts: 'bg-rose-500/15 text-rose-300',
  exports: 'bg-violet-500/15 text-violet-300',
  theme: 'bg-fuchsia-500/15 text-fuchsia-300',
  savedViews: 'bg-indigo-500/15 text-indigo-300',
}

function categoryRank(category: CommandCategory): number {
  const index = COMMAND_CATEGORY_ORDER.indexOf(category)
  return index === -1 ? COMMAND_CATEGORY_ORDER.length : index
}

/** DOM ids can't safely contain every command id character, so normalise them. */
function optionDomId(commandId: string): string {
  return `command-option-${commandId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

/** Renders `text` with the fuzzy-matched characters wrapped in `<mark>`. */
function Highlight({ text, indices }: { text: string; indices: number[] }): ReactElement {
  if (indices.length === 0) return <>{text}</>

  const marked = new Set(indices.filter((i) => i >= 0 && i < text.length))
  const nodes: ReactElement[] = []
  let buffer = ''
  let bufferMarked = false

  const flush = (key: number): void => {
    if (buffer.length === 0) return
    nodes.push(
      bufferMarked ? (
        <mark key={key} className="bg-transparent text-cyan-300 font-semibold">
          {buffer}
        </mark>
      ) : (
        <span key={key}>{buffer}</span>
      ),
    )
    buffer = ''
  }

  for (let i = 0; i < text.length; i++) {
    const isMarked = marked.has(i)
    if (isMarked !== bufferMarked) {
      flush(i)
      bufferMarked = isMarked
    }
    buffer += text[i]
  }
  flush(text.length)

  return <>{nodes}</>
}

function CategoryIcon({ category }: { category: CommandCategory }): ReactElement {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${CATEGORY_CHIP[category]}`}
      aria-hidden="true"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CATEGORY_ICON_PATH[category]} />
      </svg>
    </span>
  )
}

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
}: CommandPaletteProps): ReactElement | null {
  const { t } = useTranslation()
  const commands = useCommands()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const deferredQuery = useDeferredValue(query)
  const hasQuery = deferredQuery.trim().length > 0

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const inputId = useId()
  const listId = useId()

  const { containerRef, handleKeyDown: trapKeyDown } = useFocusTrap()

  // ── Rank + group ─────────────────────────────────────────────────────────
  const ranked = useMemo(
    () =>
      rankByFuzzy(commands, deferredQuery, (command) => ({
        primary: command.label,
        secondary: [
          command.hint ?? '',
          (command.keywords ?? []).join(' '),
          t(`commandPalette.categories.${command.category}`),
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [commands, deferredQuery, t],
  )

  const { rows, flat } = useMemo(() => {
    const byCategory = new Map<CommandCategory, RankedItem<Command>[]>()
    for (const entry of ranked) {
      const list = byCategory.get(entry.item.category)
      if (list) list.push(entry)
      else byCategory.set(entry.item.category, [entry])
    }

    const categories = [...byCategory.keys()]
    if (hasQuery) {
      // Most relevant category first; entries within a category are already
      // score-ordered, so the head is that category's best score.
      categories.sort((a, b) => byCategory.get(b)![0].score - byCategory.get(a)![0].score)
    } else {
      categories.sort((a, b) => categoryRank(a) - categoryRank(b))
    }

    const nextRows: Row[] = []
    const nextFlat: CommandEntry[] = []
    for (const category of categories) {
      nextRows.push({ kind: 'header', key: `header:${category}`, category })
      for (const entry of byCategory.get(category)!) {
        const index = nextFlat.length
        const rowIndex = nextRows.length
        nextFlat.push({
          command: entry.item,
          score: entry.score,
          indices: entry.indices,
          rowIndex,
        })
        nextRows.push({ kind: 'item', key: `item:${entry.item.id}`, index })
      }
    }
    return { rows: nextRows, flat: nextFlat }
  }, [ranked, hasQuery])

  const virtualize = rows.length > VIRTUALIZE_THRESHOLD

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => (rows[index]?.kind === 'header' ? HEADER_HEIGHT_PX : ITEM_HEIGHT_PX),
    overscan: OVERSCAN_ROWS,
    getItemKey: (index) => rows[index]?.key ?? index,
  })

  // Clamp the active index without an extra render: the list can shrink under
  // the cursor while the deferred ranking catches up.
  const active = flat.length === 0 ? -1 : Math.min(activeIndex, flat.length - 1)
  const activeEntry = active >= 0 ? flat[active] : null
  const activeCommand = activeEntry?.command ?? null

  // ── Open/close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return undefined
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()

    return () => {
      const current = document.activeElement
      // Only restore focus if it hasn't been claimed by something else (e.g. a
      // modal opened by the command that just ran).
      if (
        previouslyFocused &&
        document.contains(previouslyFocused) &&
        (current === null || current === document.body)
      ) {
        previouslyFocused.focus()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIndex(0)
  }, [isOpen])

  // Lock background scroll while the palette is open.
  useEffect(() => {
    if (!isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  // Escape is handled at the document capture phase so it closes the palette
  // before any other key handler reacts.
  useEffect(() => {
    if (!isOpen) return undefined
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, onClose])

  // Keep the active row visible.
  useEffect(() => {
    if (!isOpen || active < 0) return
    const rowIndex = flat[active]?.rowIndex
    if (rowIndex === undefined) return
    if (virtualize) {
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' })
    } else {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, active, flat, virtualize, rowVirtualizer])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const runCommand = useCallback(
    (command: Command) => {
      if (command.enabled === false) return
      onClose()
      try {
        const result = command.handler()
        if (result && typeof (result as Promise<void>).then === 'function') {
          void (result as Promise<void>).catch((error: unknown) => {
            console.error(`[CommandPalette] command "${command.id}" failed`, error)
          })
        }
      } catch (error) {
        console.error(`[CommandPalette] command "${command.id}" failed`, error)
      }
    },
    [onClose],
  )

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    // Strip markup/control characters and cap length before the query reaches
    // the matcher (mirrors the dashboard search input handling).
    setQuery(sanitizeSearchInput(event.target.value))
    setActiveIndex(0)
  }, [])

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const length = flat.length
      if (length === 0) return
      const current = Math.min(activeIndex, length - 1)

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setActiveIndex((current + 1) % length)
          break
        case 'ArrowUp':
          event.preventDefault()
          setActiveIndex((current - 1 + length) % length)
          break
        case 'Home':
          event.preventDefault()
          setActiveIndex(0)
          break
        case 'End':
          event.preventDefault()
          setActiveIndex(length - 1)
          break
        case 'PageDown':
          event.preventDefault()
          setActiveIndex(Math.min(current + PAGE_STEP, length - 1))
          break
        case 'PageUp':
          event.preventDefault()
          setActiveIndex(Math.max(current - PAGE_STEP, 0))
          break
        case 'Enter': {
          event.preventDefault()
          const entry = flat[current]
          if (entry) runCommand(entry.command)
          break
        }
        default:
          break
      }
    },
    [flat, activeIndex, runCommand],
  )

  if (!isOpen) return null

  const renderRow = (row: Row, style?: CSSProperties): ReactElement => {
    if (row.kind === 'header') {
      return (
        <div
          key={row.key}
          role="presentation"
          style={style}
          className={`px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase ${CATEGORY_ACCENT[row.category]}`}
        >
          {t(`commandPalette.categories.${row.category}`)}
        </div>
      )
    }

    const entry = flat[row.index]
    const command = entry.command
    const isActive = row.index === active
    const isDisabled = command.enabled === false

    return (
      <div
        key={row.key}
        id={optionDomId(command.id)}
        role="option"
        aria-selected={isActive}
        aria-disabled={isDisabled || undefined}
        data-option-index={row.index}
        style={style}
        onMouseEnter={() => setActiveIndex(row.index)}
        onClick={() => runCommand(command)}
        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
          isActive ? 'bg-gray-700/70 text-gray-100' : 'text-gray-300 hover:bg-gray-800/60'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <CategoryIcon category={command.category} />

        <span className="flex-1 text-sm truncate">
          <Highlight text={command.label} indices={entry.indices} />
        </span>

        {isDisabled && command.disabledReason ? (
          <span className="text-xs text-amber-400/80 truncate max-w-[12rem]">{command.disabledReason}</span>
        ) : (
          command.hint && (
            <span className="text-xs text-gray-500 truncate max-w-[10rem]" aria-hidden="true">
              {command.hint}
            </span>
          )
        )}

        {isActive && !isDisabled && (
          <kbd
            className="shrink-0 inline-flex items-center px-1 py-0.5 text-[10px] font-mono bg-gray-700 border border-gray-600 rounded text-gray-400"
            aria-hidden="true"
          >
            ↵
          </kbd>
        )}
      </div>
    )
  }

  const palette = (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <div
        aria-hidden="true"
        data-testid="palette-backdrop"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.title')}
        onKeyDown={trapKeyDown}
        className="relative w-full max-w-xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
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
            aria-label={t('commandPalette.title')}
            aria-expanded={flat.length > 0}
            aria-controls={flat.length > 0 ? listId : undefined}
            aria-activedescendant={activeCommand ? optionDomId(activeCommand.id) : undefined}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />

          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-800 border border-gray-700 rounded text-gray-400">
            Esc
          </kbd>
        </div>

        {/* Screen-reader result count */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {flat.length === 0
            ? t('commandPalette.noResults', { query })
            : t('commandPalette.resultCount', { count: flat.length })}
        </p>

        {/* Results */}
        {flat.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-400">{t('commandPalette.noResults', { query })}</p>
            <p className="mt-1 text-xs text-gray-600">{t('commandPalette.noResultsHint')}</p>
          </div>
        ) : (
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={t('commandPalette.title')}
            className="relative overflow-y-auto"
            style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
          >
            {virtualize ? (
              <>
                <div aria-hidden="true" role="presentation" style={{ height: rowVirtualizer.getTotalSize() }} />
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  if (!row) return null
                  return renderRow(row, {
                    position: 'absolute',
                    top: 0,
                    insetInlineStart: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  })
                })}
              </>
            ) : (
              rows.map((row) => renderRow(row))
            )}
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-800 text-[11px] text-gray-500">
          <span>
            <kbd className="font-mono">↑↓</kbd> {t('commandPalette.hintNavigate')}
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> {t('commandPalette.hintExecute')}
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> {t('commandPalette.hintClose')}
          </span>
        </div>
      </div>
    </div>
  )

  return createPortal(palette, document.body)
})
