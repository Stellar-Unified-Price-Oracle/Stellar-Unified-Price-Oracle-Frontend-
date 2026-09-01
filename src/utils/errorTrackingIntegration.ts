/**
 * Error Tracking Integration Points
 *
 * This file integrates error reporting into critical application flows.
 * Call setupErrorTracking() early in app initialization to enable monitoring.
 */

import { reportNetworkError, _reportWebSocketError, reportIndexedDBError, trackAsyncOperation, reportPerformanceIssue } from './errorReporting'
import { addSentryBreadcrumb } from './sentry'

/**
 * Set up error tracking for network requests.
 * Call this during app initialization.
 */
export function setupNetworkErrorTracking(): void {
  // Hook into fetch to track network errors
  const originalFetch = window.fetch

  window.fetch = function (...args: Parameters<typeof fetch>) {
    const startTime = performance.now()

    return originalFetch.apply(this, args)
      .then(async (response) => {
        const _duration = performance.now() - startTime

        // Track slow requests
        if (duration > 5000) {
          reportPerformanceIssue(`fetch: ${args[0]}`, duration, 5000)
        }

        // Log breadcrumb for successful requests
        if (response.ok) {
          addSentryBreadcrumb(`Network request successful`, {
            url: String(args[0]),
            status: response.status,
            duration: `${duration.toFixed(0)}ms`,
          })
        } else {
          // Report error responses
          const method = typeof args[1] === 'object' && args[1]?.method ? (args[1].method as string) : 'GET'
          reportNetworkError(`HTTP ${response.status}: ${response.statusText}`, {
            method,
            url: String(args[0]),
            status: response.status,
            statusText: response.statusText,
            responseTime: duration,
          })
        }

        return response
      })
      .catch((error) => {
        const _duration = performance.now() - startTime

        reportNetworkError(error instanceof Error ? error : new Error(String(error)), {
          url: String(args[0]),
          responseTime: duration,
        })

        throw error
      })
  } as typeof fetch
}

/**
 * Set up error tracking for storage operations.
 * Monitors IndexedDB errors and performance.
 */
export function setupStorageErrorTracking(): void {
  const originalOpen = indexedDB.open

  indexedDB.open = function (name: string, version?: number) {
    const request = originalOpen.apply(this, [name, version])
    const startTime = performance.now()

    request.addEventListener('success', () => {
      const _duration = performance.now() - startTime
      if (duration > 1000) {
        reportPerformanceIssue(`indexedDB.open: ${name}`, duration, 1000)
      }

      addSentryBreadcrumb(`IndexedDB opened`, {
        dbName: name,
        version,
        duration: `${duration.toFixed(0)}ms`,
      })
    })

    request.addEventListener('error', () => {
      const _duration = performance.now() - startTime
      reportIndexedDBError(`Failed to open database: ${name}`, {
        operation: 'open',
        dbName: name,
      })
    })

    return request
  }
}

/**
 * Set up error tracking for unhandled promise rejections.
 */
export function setupUnhandledRejectionTracking(): void {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))

    reportNetworkError(error, {
      url: window.location.href,
    })

    addSentryBreadcrumb(`Unhandled promise rejection`, {
      reason: String(event.reason),
    })
  })
}

/**
 * Set up error tracking for global errors.
 */
export function setupGlobalErrorTracking(): void {
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message)

    reportNetworkError(error, {
      url: window.location.href,
      status: event.lineno,
    })

    addSentryBreadcrumb(`Global error`, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })
}

/**
 * Set up performance monitoring.
 */
export function setupPerformanceMonitoring(): void {
  if (!window.PerformanceObserver) return

  try {
    // Monitor long tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          reportPerformanceIssue(entry.name, entry.duration, 50)
        }
      }
    })

    longTaskObserver.observe({ entryTypes: ['longtask', 'measure'] })

    // Monitor Core Web Vitals
    if ('PerformanceEventTiming' in window) {
      const eventObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const { duration, name } = entry
          if (duration > 100) {
            addSentryBreadcrumb(`Slow event: ${name}`, {
              duration: `${duration.toFixed(0)}ms`,
            })
          }
        }
      })

      eventObserver.observe({ entryTypes: ['event'], durable: true })
    }
  } catch (e) {
    // PerformanceObserver may not be available in all browsers
    console.debug('Performance monitoring not fully available:', e)
  }
}

/**
 * Initialize all error tracking integrations.
 * Call this early in app initialization (e.g., in main.tsx).
 */
export function setupErrorTracking(): void {
  try {
    setupGlobalErrorTracking()
    setupUnhandledRejectionTracking()
    setupNetworkErrorTracking()
    setupStorageErrorTracking()
    setupPerformanceMonitoring()

    addSentryBreadcrumb('Error tracking initialized')
  } catch (error) {
    console.error('Failed to set up error tracking:', error)
  }
}

/**
 * Create a type-safe error tracking wrapper for async operations.
 */
export function createTrackedAsyncOperation<T, A extends unknown[]>(
  name: string,
  fn: (...args: A) => Promise<T>,
) {
  return async (...args: A): Promise<T> => {
    const { result, error } = await trackAsyncOperation(name, () => fn(...args))

    if (error) {
      throw error
    }

    return result as T
  }
}
