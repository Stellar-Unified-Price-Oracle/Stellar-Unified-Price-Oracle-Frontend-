import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'

export interface CapturedError {
  id: string
  error: Error
  info: ErrorInfo
  boundaryId: string
  timestamp: number
}

export interface ErrorReporterContextValue {
  /** All errors collected since mount or last clear. */
  errors: CapturedError[]
  /** The most recent error, or null when the list is empty. */
  lastError: CapturedError | null
  /** Record an error from any ErrorBoundary in the tree. */
  captureError: (error: Error, info: ErrorInfo, boundaryId: string) => void
  /** Clear all collected errors. */
  clearErrors: () => void
}

const ErrorReporterContext = createContext<ErrorReporterContextValue | null>(null)

let _seq = 0
function nextId(): string {
  return `err-${Date.now()}-${_seq++}`
}

/**
 * Provides a tree-wide error collection store.
 *
 * ErrorBoundary instances throughout the tree call `captureError` so errors are
 * visible in a single place (useful for a debug overlay or analytics).
 * Optionally forwards errors to an analytics endpoint when `VITE_ERROR_ENDPOINT`
 * is set.
 */
export function ErrorReporterProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<CapturedError[]>([])

  const captureError = useCallback(
    (error: Error, info: ErrorInfo, boundaryId: string) => {
      const entry: CapturedError = {
        id: nextId(),
        error,
        info,
        boundaryId,
        timestamp: Date.now(),
      }

      setErrors((prev) => [...prev, entry])

      // Optional: send to analytics endpoint
      const endpoint = import.meta.env.VITE_ERROR_ENDPOINT as string | undefined
      if (endpoint) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: info.componentStack,
            boundaryId,
            timestamp: entry.timestamp,
          }),
          // Fire-and-forget; don't let reporting errors bubble up
        }).catch(() => {})
      }
    },
    [],
  )

  const clearErrors = useCallback(() => setErrors([]), [])

  const value: ErrorReporterContextValue = {
    errors,
    lastError: errors.length > 0 ? errors[errors.length - 1] : null,
    captureError,
    clearErrors,
  }

  return (
    <ErrorReporterContext.Provider value={value}>
      {children}
    </ErrorReporterContext.Provider>
  )
}

/** Returns the ErrorReporter context. Must be used within an {@link ErrorReporterProvider}. */
export function useErrorReporter(): ErrorReporterContextValue {
  const ctx = useContext(ErrorReporterContext)
  if (!ctx) {
    throw new Error('useErrorReporter must be used within an ErrorReporterProvider')
  }
  return ctx
}
