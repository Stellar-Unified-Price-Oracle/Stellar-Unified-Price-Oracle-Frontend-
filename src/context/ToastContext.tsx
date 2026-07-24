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

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 4000

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
    (toast: Omit<Toast, 'id'>): string => {
      const id = crypto.randomUUID()
      const duration = toast.duration ?? DEFAULT_DURATION
      setToasts((prev) => [...prev, { ...toast, id }])
      if (duration > 0) {
        const timer = setTimeout(() => removeToast(id), duration)
        timersRef.current.set(id, timer)
      }
      return id
    },
    [removeToast],
  )

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
    apiErrorToastListener = (message) => addToast({ type: 'error', message })
    return () => {
      apiErrorToastListener = null
    }
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
