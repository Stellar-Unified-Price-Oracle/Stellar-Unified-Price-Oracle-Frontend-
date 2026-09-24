import { memo, useState, useRef, useEffect, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExportFormat } from '../hooks/useExport'

interface ExportButtonProps {
  onExport: (format: ExportFormat) => void
  exporting: boolean
  disabled?: boolean
  /** Whether the export rate limit allows a new export right now. */
  exportAllowed?: boolean
  /** Seconds until the next export is allowed (0 = no cooldown). */
  exportCooldownSec?: number
}

export const ExportButton = memo(function ExportButton({
  onExport,
  exporting,
  disabled,
  exportAllowed = true,
  exportCooldownSec = 0,
}: ExportButtonProps): ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const isThrottled = !exportAllowed && exportCooldownSec > 0
  const isDisabled = disabled || exporting || isThrottled

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close dropdown when throttled — don't leave it hanging open.
  useEffect(() => {
    if (isThrottled) setOpen(false)
  }, [isThrottled])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !isDisabled && setOpen((o) => !o)}
        disabled={isDisabled}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-gray-400 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={
          isThrottled
            ? t('export.rateLimitedLabel', { sec: exportCooldownSec, defaultValue: `Export rate limited — try again in ${exportCooldownSec}s` })
            : t('export.ariaLabel')
        }
        aria-expanded={open}
        aria-haspopup="true"
        title={isThrottled ? t('export.rateLimitedTitle', { sec: exportCooldownSec, defaultValue: `Too many exports — try again in ${exportCooldownSec}s` }) : undefined}
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

        {isThrottled ? (
          <span className="tabular-nums">
            {t('export.cooldownLabel', { sec: exportCooldownSec, defaultValue: `${exportCooldownSec}s` })}
          </span>
        ) : (
          t('export.button')
        )}

        {!isThrottled && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && !isThrottled && (
        <div
          className="absolute right-0 mt-1 w-40 bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden"
          role="menu"
        >
          {(['csv', 'json', 'xlsx'] as ExportFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onExport(fmt)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              {fmt === 'xlsx' && (
                <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {t('export.exportAs', { format: fmt.toUpperCase() })}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
