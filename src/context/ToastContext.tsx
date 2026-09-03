import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

/** Priority determines visual order and auto-dismiss behaviour */
export type ToastPriority = 'low' | 'normal' | 'high' | 'critical'

/** An action button rendered inside the toast */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  type: ToastType
  message: string
  /** Optional secondary detail text */
  description?: string
  /** Auto-dismiss duration in ms. 0 = no auto-dismiss. Defaults to 4 000 ms. */
  duration?: number
  /** Influences stacking order and auto-dismiss: higher priority stays longer and renders on top */
  priority?: ToastPriority
  /** Up to 2 action buttons */
  actions?: ToastAction[]
  /** Timestamp when added, used for deduplication and ordering */
  addedAt?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'addedAt'>) => string
  removeToast: (id: string) => void
  /** Remove all toasts */
  clearToasts: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Priority order (higher index = higher priority) */
const PRIORITY_ORDER: Record<ToastPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
}

/** Default durations per priority */
const DEFAULT_DURATIONS: Record<ToastPriority, number> = {
  low: 3000,
  normal: 4000,
  high: 6000,
  critical: 0, // critical never auto-dismisses
}

/** Max number of toasts visible simultaneously */
const MAX_VISIBLE = 5

type ApiErrorToastListener = (message: string) => void

let apiErrorToastListener: ApiErrorToastListener | null = null

/**
 * Lets non-React modules (the API client in `src/api/rest.ts`) show an error
 * toast without needing to be inside a ToastProvider's component tree.
 * No-ops when no ToastProvider is currently mounted (e.g. in unit tests that
 * render a component in isolation).
 */
export function showApiErrorToast(message: string): void {
  apiErrorToastListener?.(message)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id' | 'addedAt'>): string => {
      const id = crypto.randomUUID()
      const priority = toast.priority ?? 'normal'
      const duration =
        toast.duration !== undefined
          ? toast.duration
          : DEFAULT_DURATIONS[priority]

      const newToast: Toast = {
        ...toast,
        id,
        priority,
        addedAt: Date.now(),
      }

      setToasts((prev) => {
        // Deduplicate: don't stack identical messages of the same type
        const duplicate = prev.find(
          (t) => t.type === toast.type && t.message === toast.message,
        )
        if (duplicate) return prev

        const next = [...prev, newToast]

        // Keep only MAX_VISIBLE — remove the oldest lowest-priority ones first
        if (next.length > MAX_VISIBLE) {
          const sorted = [...next].sort((a, b) => {
            const pa = PRIORITY_ORDER[a.priority ?? 'normal']
            const pb = PRIORITY_ORDER[b.priority ?? 'normal']
            if (pa !== pb) return pa - pb // lower priority first for removal
            return (a.addedAt ?? 0) - (b.addedAt ?? 0) // older first
          })
          const toRemove = sorted.slice(0, next.length - MAX_VISIBLE)
          toRemove.forEach((t) => {
            const timer = timersRef.current.get(t.id)
            if (timer) {
              clearTimeout(timer)
              timersRef.current.delete(t.id)
            }
          })
          const removeIds = new Set(toRemove.map((t) => t.id))
          return next.filter((t) => !removeIds.has(t.id))
        }
        return next
      })

      if (duration > 0) {
        const timer = setTimeout(() => removeToast(id), duration)
        timersRef.current.set(id, timer)
      }
      return id
    },
    [removeToast],
  )

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current.clear()
    setToasts([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // Register this provider as the target for showApiErrorToast() calls from
  // outside the React tree (e.g. src/api/rest.ts).
  useEffect(() => {
    apiErrorToastListener = (message) =>
      addToast({ type: 'error', message, priority: 'high' })
    return () => {
      apiErrorToastListener = null
    }
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
