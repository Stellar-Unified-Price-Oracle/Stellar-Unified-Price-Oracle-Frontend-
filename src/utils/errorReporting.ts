/**
 * Error Reporting Utilities
 *
 * High-level helpers for consistent error tracking, context management,
 * and breadcrumb logging across the application.
 *
 * Usage:
 * ```tsx
 * import { reportError, withErrorHandler, createErrorContext } from './utils/errorReporting'
 *
 * // Simple error reporting
 * try {
 *   await fetchData()
 * } catch (error) {
 *   reportError(error, { operation: 'fetch-data' })
 * }
 *
 * // Wrap async operations
 * const safeFetch = withErrorHandler(async () => {
 *   return await fetch('/api/prices')
 * }, { component: 'PriceCard' })
 *
 * // Create error context for a feature
 * const priceContext = createErrorContext('price-fetching', {
 *   apiUrl: config.apiUrl,
 *   timeout: 5000,
 * })
 * ```
 */

import { captureError, captureMessage, addSentryBreadcrumb, setSentryContext, getSentryConfig } from './sentry'

export interface ErrorContext {
  component?: string
  operation?: string
  userId?: string
  sessionId?: string
  [key: string]: unknown
}

export interface ErrorReportOptions {
  context?: ErrorContext
  tags?: Record<string, string>
  level?: 'fatal' | 'error' | 'warning' | 'info'
  shouldThrow?: boolean
  notifyUser?: boolean
}

export interface ErrorReport {
  id: string
  message: string
  timestamp: number
  context?: ErrorContext
  stack?: string
}

let _errorReports: ErrorReport[] = []
const MAX_STORED_ERRORS = 50

/**
 * Report an error with optional context.
 * Returns the Sentry event ID for tracking.
 */
export function reportError(
  error: Error | string,
  options: ErrorReportOptions = {},
): string {
  const {
    context = {},
    tags = {},
    level = 'error',
    shouldThrow = false,
    notifyUser = false,
  } = options

  const errorMessage = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  // Store locally for debugging
  const report: ErrorReport = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    message: errorMessage,
    timestamp: Date.now(),
    context,
    stack,
  }

  _errorReports.push(report)
  if (_errorReports.length > MAX_STORED_ERRORS) {
    _errorReports.shift()
  }

  // Set context in Sentry
  if (getSentryConfig().enabled) {
    setSentryContext('error-context', context)
  }

  // Add breadcrumb
  addSentryBreadcrumb(
    `Error: ${errorMessage}`,
    { ...context, tags, level },
    level === 'fatal' ? 'error' : level,
  )

  // Report to Sentry
  const eventId = captureError(error, {
    ...context,
    tags,
    level,
  })

  // Log locally
  console.error(`[ErrorReport ${report.id}]`, errorMessage, {
    context,
    stack,
  })

  // Optionally notify user
  if (notifyUser) {
    // TODO: Integrate with toast notification system
    console.warn(`User notification for error: ${errorMessage}`)
  }

  // Optionally re-throw
  if (shouldThrow && error instanceof Error) {
    throw error
  }

  return eventId
}

/**
 * Wrap an async function with automatic error handling.
 */
export function withErrorHandler<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  options: ErrorReportOptions = {},
): (...args: A) => Promise<T | null> {
  return async (...args: A): Promise<T | null> => {
    try {
      return await fn(...args)
    } catch (error: unknown) {
      reportError(error as Error | string, options)
      return null
    }
  }
}

/**
 * Wrap a synchronous function with automatic error handling.
 */
export function withSyncErrorHandler<T, A extends unknown[]>(
  fn: (...args: A) => T,
  options: ErrorReportOptions = {},
): (...args: A) => T | null {
  return (...args: A): T | null => {
    try {
      return fn(...args)
    } catch (error: unknown) {
      reportError(error as Error | string, options)
      return null
    }
  }
}

/**
 * Create a context for a specific feature or component.
 * All errors reported within this context will include the provided metadata.
 */
export function createErrorContext(
  componentName: string,
  metadata: Record<string, unknown> = {},
) {
  return {
    component: componentName,
    ...metadata,
  }
}

/**
 * Wrap an async operation with timing and error tracking.
 */
export async function trackAsyncOperation<T>(
  name: string,
  fn: () => Promise<T>,
  context?: ErrorContext,
): Promise<{ result: T | null; duration: number; error?: Error }> {
  const startTime = performance.now()

  try {
    addSentryBreadcrumb(`Starting operation: ${name}`, { context })
    const result = await fn()
    const duration = performance.now() - startTime

    addSentryBreadcrumb(`Completed operation: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
    })

    return { result, duration }
  } catch (error: unknown) {
    const duration = performance.now() - startTime
    const err = error instanceof Error ? error : new Error(String(error))

    reportError(err, {
      context: {
        operation: name,
        duration: `${duration.toFixed(2)}ms`,
        ...context,
      },
      level: 'error',
    })

    return {
      result: null,
      duration,
      error: err,
    }
  }
}

/**
 * Get all stored error reports (for debugging).
 */
export function getStoredErrorReports(): ErrorReport[] {
  return [..._errorReports]
}

/**
 * Clear stored error reports.
 */
export function clearStoredErrorReports(): void {
  _errorReports = []
}

/**
 * Export error reports as JSON (for support/debugging).
 */
export function exportErrorReports(): string {
  return JSON.stringify(_errorReports, null, 2)
}

/**
 * Report a network error with specific context.
 */
export function reportNetworkError(
  error: Error | string,
  details: {
    method?: string
    url?: string
    status?: number
    statusText?: string
    responseTime?: number
  } = {},
): string {
  return reportError(error, {
    context: {
      operation: 'network-request',
      ...details,
    },
    tags: {
      type: 'network-error',
      severity: details.status && details.status >= 500 ? 'high' : 'medium',
    },
    level: details.status && details.status >= 500 ? 'error' : 'warning',
  })
}

/**
 * Report an API error with response details.
 */
export function reportApiError(
  error: Error | string,
  details: {
    endpoint?: string
    method?: string
    statusCode?: number
    responseBody?: unknown
  } = {},
): string {
  return reportError(error, {
    context: {
      operation: 'api-call',
      ...details,
    },
    tags: {
      type: 'api-error',
      endpoint: details.endpoint || 'unknown',
    },
    level: details.statusCode && details.statusCode >= 500 ? 'error' : 'warning',
  })
}

/**
 * Report a WebSocket error.
 */
export function reportWebSocketError(
  error: Error | string,
  details: {
    event?: string
    url?: string
    code?: number
    reason?: string
  } = {},
): string {
  return reportError(error, {
    context: {
      operation: 'websocket',
      ...details,
    },
    tags: {
      type: 'websocket-error',
    },
    level: 'error',
  })
}

/**
 * Report an IndexedDB error.
 */
export function reportIndexedDBError(
  error: Error | string,
  details: {
    operation?: string
    storeName?: string
    dbName?: string
  } = {},
): string {
  return reportError(error, {
    context: {
      operation: 'indexeddb',
      ...details,
    },
    tags: {
      type: 'indexeddb-error',
    },
    level: 'warning',
  })
}

/**
 * Report a performance issue.
 */
export function reportPerformanceIssue(
  name: string,
  duration: number,
  threshold: number,
): void {
  if (duration > threshold) {
    captureMessage(`Performance issue: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`, 'warning')

    addSentryBreadcrumb(`Slow operation: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${threshold}ms`,
      slowBy: `${(duration - threshold).toFixed(2)}ms`,
    })
  }
}

/**
 * Create a type-safe error handler for a specific domain.
 */
export function createDomainErrorHandler(domain: string) {
  return {
    report(error: Error | string, context?: Record<string, unknown>): string {
      return reportError(error, {
        context: {
          domain,
          ...context,
        },
        tags: {
          domain,
        },
      })
    },

    withHandler<T, A extends unknown[]>(fn: (...args: A) => Promise<T>) {
      return withErrorHandler(fn, {
        context: { domain },
        tags: { domain },
      })
    },

    async track<T>(name: string, fn: () => Promise<T>) {
      return trackAsyncOperation(`${domain}:${name}`, fn, { domain })
    },
  }
}
