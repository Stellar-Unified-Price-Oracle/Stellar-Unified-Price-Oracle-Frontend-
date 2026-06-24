import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useToast, type Toast, type ToastType } from '../context/ToastContext'

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

const STYLES: Record<ToastType, string> = {
  success: 'bg-gray-900 border-green-500/40 text-green-400',
  error: 'bg-gray-900 border-red-500/40 text-red-400',
  warning: 'bg-gray-900 border-amber-500/40 text-amber-400',
  info: 'bg-gray-900 border-cyan-500/40 text-cyan-400',
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast()
  const ref = useRef<HTMLDivElement>(null)

  // Swipe-to-dismiss (touch)
  const touchStartX = useRef(0)
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 60) removeToast(toast.id)
  }

  // Keyboard: Delete or Escape closes this toast when focused
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Escape') {
      removeToast(toast.id)
    }
  }

  useEffect(() => {
    // Announce via aria-live (the container handles it), just animate in
    const el = ref.current
    if (el) {
      el.style.opacity = '0'
      el.style.transform = 'translateX(1rem)'
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
        el.style.opacity = '1'
        el.style.transform = 'translateX(0)'
      })
    }
  }, [])

  return (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium max-w-sm w-full cursor-pointer select-none ${STYLES[toast.type]}`}
      onClick={() => removeToast(toast.id)}
    >
      {ICONS[toast.type]}
      <span className="flex-1 text-gray-100">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
        className="text-gray-500 hover:text-gray-300 transition-colors ml-1 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
