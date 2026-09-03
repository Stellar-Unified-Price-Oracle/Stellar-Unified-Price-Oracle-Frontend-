import { useEffect, useRef, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useToast, type Toast, type ToastType, type ToastPriority } from '../context/ToastContext'
import { useAnnounce } from '../hooks/useAnnounce'

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-gray-900 border-green-500/40 text-green-400',
  error: 'bg-gray-900 border-red-500/40 text-red-400',
  warning: 'bg-gray-900 border-amber-500/40 text-amber-400',
  info: 'bg-gray-900 border-cyan-500/40 text-cyan-400',
}

const ACTION_STYLES: Record<ToastType, string> = {
  success: 'text-green-400 hover:text-green-300 border-green-500/40 hover:bg-green-500/10',
  error: 'text-red-400 hover:text-red-300 border-red-500/40 hover:bg-red-500/10',
  warning: 'text-amber-400 hover:text-amber-300 border-amber-500/40 hover:bg-amber-500/10',
  info: 'text-cyan-400 hover:text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/10',
}

/** Accent bar on the left edge based on priority */
const PRIORITY_ACCENT: Record<ToastPriority, string> = {
  low: '',
  normal: '',
  high: 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-amber-400 before:rounded-l-xl',
  critical: 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-red-500 before:rounded-l-xl',
}

function ToastItem({ toast, index }: { toast: Toast; index: number }) {
  const { removeToast } = useToast()
  const { announce } = useAnnounce()
  const ref = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const announcedRef = useRef(false)

  // Announce toast to screen readers on mount
  useEffect(() => {
    if (!announcedRef.current) {
      announcedRef.current = true
      const priority = toast.priority ?? 'normal'
      const isUrgent = priority === 'critical' || priority === 'high'
      
      // Build announcement message
      let message = toast.message
      if (toast.description) {
        message += `. ${toast.description}`
      }
      if (toast.type !== 'info') {
        message = `${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}: ${message}`
      }
      
      // Announce with appropriate priority
      announce(message, isUrgent ? 'assertive' : 'polite')
    }
  }, [toast, announce])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 60) removeToast(toast.id)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Delete' || (e.key === 'Escape' && !e.defaultPrevented)) {
      removeToast(toast.id)
    }
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    
    // If reduced motion is active, show toast immediately without animation
    if (reducedMotion) {
      el.style.opacity = '1'
      el.style.transform = 'translateX(0) scale(1)'
      el.style.transition = 'none'
      return
    }
    
    el.style.opacity = '0'
    el.style.transform = 'translateX(1rem) scale(0.97)'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateX(0) scale(1)'
    })
  }, [reducedMotion])

  const priority = toast.priority ?? 'normal'
  const accentClass = PRIORITY_ACCENT[priority]

  return (
    <div
      ref={ref}
      role="alert"
      aria-live={priority === 'critical' || priority === 'high' ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`relative flex flex-col gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium w-full max-w-sm overflow-hidden ${TYPE_STYLES[toast.type]} ${accentClass}`}
      style={{ zIndex: 10 - index }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3">
        {ICONS[toast.type]}
        <div className="flex-1 min-w-0">
          <p className="text-gray-100 leading-snug">{toast.message}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs text-gray-400 leading-snug">{toast.description}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => removeToast(toast.id)}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 mt-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      {toast.actions && toast.actions.length > 0 && (
        <div className="flex items-center gap-2 pl-8">
          {toast.actions.slice(0, 2).map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                action.onClick()
                removeToast(toast.id)
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${ACTION_STYLES[toast.type]}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ToastContainer(): ReactElement | null {
  const { toasts, clearToasts } = useToast()

  if (toasts.length === 0) return null

  // Sort by priority desc, then by time asc (newest high-priority on top)
  const sorted = [...toasts].sort((a, b) => {
    const PRIORITY_ORDER: Record<ToastPriority, number> = { low: 0, normal: 1, high: 2, critical: 3 }
    const pa = PRIORITY_ORDER[a.priority ?? 'normal']
    const pb = PRIORITY_ORDER[b.priority ?? 'normal']
    if (pa !== pb) return pb - pa
    return (b.addedAt ?? 0) - (a.addedAt ?? 0)
  })

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9998] flex flex-col-reverse gap-2 items-end pointer-events-none"
    >
      {/* Clear all button when multiple toasts */}
      {toasts.length > 1 && (
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={clearToasts}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
          >
            Clear all ({toasts.length})
          </button>
        </div>
      )}
      {sorted.map((toast, index) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
          <ToastItem toast={toast} index={index} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
