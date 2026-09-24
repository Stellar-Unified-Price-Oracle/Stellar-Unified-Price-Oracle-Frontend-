/**
 * ViewManager — Saved dashboard views dropdown.
 *
 * A button-triggered popover that lets users:
 * 1. Browse and activate their saved views.
 * 2. Copy a shareable deep-link for any view.
 * 3. Delete a saved view.
 * 4. Save the current dashboard state as a new named view.
 *
 * @example
 * <ViewManager
 *   currentSearch={search}
 *   currentFilters={filters}
 *   currentSortField={sortField}
 *   currentSortDirection={sortDir}
 *   currentViewMode={viewMode}
 * />
 */

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { useSavedViews } from '../hooks/useSavedViews'
import { savedViewToUrlParams } from '../services/indexedDB'
import { useToast } from '../context/ToastContext'
import type { SavedView } from '../services/indexedDB'

export interface ViewManagerProps {
  currentSearch?: string
  currentFilters?: Record<string, unknown>
  currentSortField?: string
  currentSortDirection?: 'asc' | 'desc'
  currentViewMode?: 'grid' | 'table'
}

// ─── Small, re-usable icon components ───────────────────────────────────────

function IconBookmark(): ReactElement {
  return (
    <svg
      className="w-4 h-4"
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

function IconLink(): ReactElement {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

function IconTrash(): ReactElement {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function IconPlay(): ReactElement {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function IconChevronDown(): ReactElement {
  return (
    <svg
      className="w-4 h-4 ml-1"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ─── ViewItem ────────────────────────────────────────────────────────────────

interface ViewItemProps {
  view: SavedView
  onActivate: (id: string) => void
  onCopyLink: (view: SavedView) => void
  onDelete: (id: string) => void
}

const ViewItem = memo(function ViewItem({
  view,
  onActivate,
  onCopyLink,
  onDelete,
}: ViewItemProps): ReactElement {
  return (
    <li
      role="menuitem"
      className="flex items-start gap-2 px-3 py-2 hover:bg-gray-700/60 rounded-md group"
    >
      {/* View info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 truncate">{view.name}</p>
        {view.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{view.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onActivate(view.id)}
          className="p-1 rounded text-green-400 hover:bg-green-900/40 hover:text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          aria-label={`Activate view: ${view.name}`}
          title="Activate this view"
        >
          <IconPlay />
        </button>

        <button
          type="button"
          onClick={() => onCopyLink(view)}
          className="p-1 rounded text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`Copy deep link for view: ${view.name}`}
          title="Copy shareable link"
        >
          <IconLink />
        </button>

        <button
          type="button"
          onClick={() => onDelete(view.id)}
          className="p-1 rounded text-red-400 hover:bg-red-900/40 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label={`Delete view: ${view.name}`}
          title="Delete view"
        >
          <IconTrash />
        </button>
      </div>
    </li>
  )
})

// ─── ViewManager ─────────────────────────────────────────────────────────────

export const ViewManager = memo(function ViewManager({
  currentSearch = '',
  currentFilters = {},
  currentSortField = '',
  currentSortDirection = 'desc',
  currentViewMode = 'grid',
}: ViewManagerProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const listId = useId()
  const formId = useId()
  const nameId = useId()
  const descId = useId()

  const { views, loading, saveView, deleteView, activateView } = useSavedViews()
  const { addToast } = useToast()

  // Close popover on Escape and outside click
  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isOpen])

  // Focus the name input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Defer to allow the panel to render
      const id = setTimeout(() => nameInputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
    return undefined
  }, [isOpen])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleActivate = useCallback(
    (id: string) => {
      activateView(id)
      setIsOpen(false)
    },
    [activateView],
  )

  const handleCopyLink = useCallback(
    (view: SavedView) => {
      const qs = savedViewToUrlParams(view)
      const url = `${window.location.origin}${window.location.pathname}?${qs}`
      navigator.clipboard
        .writeText(url)
        .then(() => {
          addToast({ type: 'success', message: 'Link copied to clipboard' })
        })
        .catch(() => {
          addToast({ type: 'error', message: 'Failed to copy link' })
        })
    },
    [addToast],
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteView(id)
    },
    [deleteView],
  )

  const handleSave = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) {
        addToast({ type: 'error', message: 'Please enter a view name' })
        nameInputRef.current?.focus()
        return
      }

      setIsSaving(true)
      saveView({
        name: trimmed,
        description: description.trim() || undefined,
        search: currentSearch,
        filters: currentFilters,
        sortField: currentSortField,
        sortDirection: currentSortDirection,
        viewMode: currentViewMode,
      })
      setName('')
      setDescription('')
      setIsSaving(false)
    },
    [
      name,
      description,
      saveView,
      addToast,
      currentSearch,
      currentFilters,
      currentSortField,
      currentSortDirection,
      currentViewMode,
    ],
  )

  // Keyboard navigation within the panel
  const handlePanelKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') return // let natural tab flow handle it
    // Arrow keys move focus between focusable elements inside the panel
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
        ),
      )
      const current = document.activeElement as HTMLElement
      const idx = focusable.indexOf(current)
      if (idx === -1) {
        focusable[0]?.focus()
        return
      }
      const next =
        e.key === 'ArrowDown'
          ? (idx + 1) % focusable.length
          : (idx - 1 + focusable.length) % focusable.length
      e.preventDefault()
      focusable[next]?.focus()
    }
  }, [])

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-gray-800 border border-gray-700 text-gray-200 rounded-md hover:bg-gray-700 hover:border-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
      >
        <IconBookmark />
        Saved Views
        <IconChevronDown />
      </button>

      {/* Popover panel — rendered inline (no portal needed; positioned absolutely) */}
      {isOpen && (
        <div
          ref={panelRef}
          id={listId}
          role="menu"
          aria-label="Saved dashboard views"
          onKeyDown={handlePanelKeyDown}
          className="absolute right-0 mt-1.5 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-100">Saved Views</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Save your current filter / sort state as a named view
            </p>
          </div>

          {/* View list */}
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
            ) : views.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No saved views yet</p>
            ) : (
              <ul
                aria-label="Saved views list"
                className="px-2 py-2 space-y-0.5"
              >
                {views.map((view) => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    onActivate={handleActivate}
                    onCopyLink={handleCopyLink}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Save current view form */}
          <div className="border-t border-gray-800 px-4 py-3">
            <p className="text-xs font-medium text-gray-300 mb-2">Save current view</p>
            <form
              id={formId}
              onSubmit={handleSave}
              aria-label="Save current view"
              className="space-y-2"
            >
              <div>
                <label
                  htmlFor={nameId}
                  className="block text-xs text-gray-400 mb-1"
                >
                  Name <span aria-hidden="true" className="text-red-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  id={nameId}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My view…"
                  maxLength={80}
                  required
                  className="w-full px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor={descId}
                  className="block text-xs text-gray-400 mb-1"
                >
                  Description{' '}
                  <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  id={descId}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. High-confidence BTC pairs"
                  maxLength={160}
                  className="w-full px-2.5 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="w-full mt-1 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save view'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
})
