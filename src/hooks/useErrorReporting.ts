/**
 * React Hook for Error Reporting
 *
 * Provides convenient error reporting within React components.
 * Integrates with Sentry and includes component context tracking.
 */

import { useCallback, useRef } from 'react'
import { reportError, withErrorHandler, trackAsyncOperation, ErrorContext } from '../utils/errorReporting'

export interface UseErrorReportingOptions {
  componentName?: string
  context?: ErrorContext
}

/**
 * Hook that provides error reporting utilities in a React component.
 *
 * @example
 * ```tsx
 * export function MyComponent() {
 *   const { reportError, withHandler } = useErrorReporting({
 *     componentName: 'MyComponent',
 *   })
 *
 *   const handleClick = withHandler(async () => {
 *     await fetchData()
 *   })
 *
 *   return <button onClick={handleClick}>Fetch</button>
 * }
 * ```
 */
export function useErrorReporting(options: UseErrorReportingOptions = {}) {
  const { componentName, context = {} } = options
  const componentContextRef = useRef({
    component: componentName,
    ...context,
  })

  const report = useCallback(
    (error: Error | string, additionalContext?: Record<string, unknown>) => {
      return reportError(error, {
        context: {
          ...componentContextRef.current,
          ...additionalContext,
        },
      })
    },
    [],
  )

  const withHandler = useCallback(
    <T extends unknown[], R>(
      fn: (...args: T) => Promise<R>,
      errorContext?: Record<string, unknown>,
    ) => {
      return withErrorHandler(fn, {
        context: {
          ...componentContextRef.current,
          ...errorContext,
        },
      })
    },
    [],
  )

  const track = useCallback(
    async <R,>(name: string, fn: () => Promise<R>) => {
      return trackAsyncOperation(name, fn, componentContextRef.current)
    },
    [],
  )

  return {
    reportError: report,
    withHandler,
    track,
  }
}
