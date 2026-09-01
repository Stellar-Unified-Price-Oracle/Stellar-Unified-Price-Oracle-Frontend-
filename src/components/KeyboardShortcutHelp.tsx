import { useEffect, useRef, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { ShortcutDefinition } from '../hooks/useKeyboardShortcuts'

interface KeyboardShortcutHelpProps {
  shortcuts: ShortcutDefinition[]
  onClose: () => void
}

function formatKeys(keys: string): string[] {
  return keys.split('+').map((k) => {
    switch (k.toLowerCase().trim()) {
      case 'ctrl':
        return 'Ctrl'
      case 'shift':
        return 'Shift'
      case 'alt':
        return 'Alt'
      case 'meta':
      case 'cmd':
        return '⌘'
      case 'escape':
        return 'Esc'
      case 'arrowup':
        return '↑'
      case 'arrowdown':
        return '↓'
      case 'arrowleft':
        return '←'
      case 'arrowright':
        return '→'
      case ' ':
        return 'Space'
      default:
        return k.toUpperCase().trim()
    }
  })
}

function KeyChip({ keys }: { keys: string }) {
  // Handle sequences like 'g d'
  const parts = keys.trim().split(' ')
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-gray-500 text-xs mx-0.5">then</span>}
          {formatKeys(part).map((k, j) => (
            <kbd
              key={j}
              className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-mono font-medium bg-gray-800 border border-gray-600 rounded text-gray-200 shadow-sm"
            >
              {k}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  )
}

export function KeyboardShortcutHelp({
  shortcuts,
  onClose,
}: KeyboardShortcutHelpProps): ReactElement {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape or click-outside
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Focus the overlay when it mounts
  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  // Group shortcuts by category
  const grouped = shortcuts.reduce<Record<string, ShortcutDefinition[]>>(
    (acc, s) => {
      const cat = s.category ?? 'General'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(s)
      return acc
    },
    {},
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={overlayRef}
        tabIndex={-1}
        className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-base font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                {category}
              </h3>
              <ul className="space-y-1">
                {items.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 py-1.5 px-2 rounded-lg hover:bg-gray-800/50"
                  >
                    <span className="text-sm text-gray-300">{s.description}</span>
                    <KeyChip keys={s.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500 text-center rounded-b-2xl">
          Press <kbd className="inline-flex px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-gray-300 font-mono">?</kbd> or <kbd className="inline-flex px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-gray-300 font-mono">Shift+/</kbd> to toggle this help
        </div>
      </div>
    </div>,
    document.body,
  )
}
