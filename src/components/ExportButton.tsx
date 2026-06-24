import { useState, useRef, useEffect } from 'react'
import type { ExportFormat } from '../hooks/useExport'

interface ExportButtonProps {
  onExport: (format: ExportFormat) => void
  exporting: boolean
  disabled?: boolean
}

export function ExportButton({ onExport, exporting, disabled }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || exporting}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-gray-400 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Export data"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {exporting ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        Export
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden"
          role="menu"
        >
          {(['csv', 'json'] as ExportFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onExport(fmt)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Export as {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
