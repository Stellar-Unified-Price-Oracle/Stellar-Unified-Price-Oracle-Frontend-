/**
 * @file ErrorBoundary
 *
 * React class-based error boundary that catches render-time errors in its
 * subtree and displays a contextual fallback UI with recovery actions.
 *
 * @example Wrapping a page route
 * ```tsx
 * <ErrorBoundary showGoBack>
 *   <PriceDetail />
 * </ErrorBoundary>
 * ```
 *
 * @example Wrapping a feature widget with a custom label
 * ```tsx
 * <ErrorBoundary featureLabel="Price Chart">
 *   <PriceChart data={history} />
 * </ErrorBoundary>
 * ```
 *
 * @example Integrating with an error reporter
 * ```tsx
 * const { report } = useErrorReporter()
 *
 * <ErrorBoundary
 *   boundaryId="dashboard-table"
 *   onError={(error, info) => report(error, { boundaryId: 'dashboard-table', info })}
 * >
 *   <PriceTableView ... />
 * </ErrorBoundary>
 * ```
 *
 * @example Custom fallback element
 * ```tsx
 * <ErrorBoundary fallback={<p className="text-red-500">Chart unavailable</p>}>
 *   <PriceChart data={history} />
 * </ErrorBoundary>
 * ```
 *
 * ## Recovery actions
 * - **Retry** — resets boundary state so the subtree is re-mounted from scratch.
 * - **Go back** — calls `history.back()`. Only shown when `showGoBack` is `true`.
 * - **Show details** — toggles the raw error message. Visible in development
 *   (`import.meta.env.DEV`) and hidden in production builds.
 *
 * ## Edge cases
 * - **Error in the fallback itself** — React will unmount the boundary entirely and
 *   propagate the error to the next boundary up the tree.
 * - **Async errors** — only synchronous render-time errors are caught. Errors in
 *   `useEffect`, event handlers, or async functions must be caught separately (use
 *   `useErrorReporter` for those).
 * - **Retry loops** — if the underlying bug persists, pressing Retry re-mounts and
 *   re-throws, leaving the fallback visible again with no infinite loop.
 *
 * ## Accessibility
 * - The fallback heading uses the `featureLabel` prop to give context, e.g.
 *   "Something went wrong in Price Chart".
 * - All interactive recovery buttons are standard `<button>` elements with
 *   descriptive labels.
 * - Error detail text is wrapped in `<pre>` for screen-reader compatibility.
 */
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback element rendered instead of the built-in error UI. */
  fallback?: ReactNode
  /**
   * Called when an error is caught.  Use this to integrate with
   * {@link useErrorReporter} or any external error tracking service.
   */
  onError?: (error: Error, info: ErrorInfo) => void
  /**
   * Stable string used to identify this boundary in error reports and in the
   * "Show details" panel.  Defaults to `'unknown'`.
   */
  boundaryId?: string
  /** When `true` the "Go back" button is shown for page-level boundaries. */
  showGoBack?: boolean
  /**
   * Label shown in the contextual fallback heading, e.g. `"Price Chart"`.
   * Defaults to `"This section"`.
   */
  featureLabel?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  showDetails: boolean
}

/**
 * Catches render-time errors in its subtree and displays a contextual fallback
 * UI with recovery actions:
 *
 * - **Retry** – resets the boundary so the subtree is re-mounted.
 * - **Go back** – calls `history.back()` (shown only when `showGoBack` is `true`).
 * - **Show details** – reveals the error message (dev-only by default via
 *   `import.meta.env.DEV`).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false })
  }

  private handleGoBack = () => {
    window.history.back()
  }

  private toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // Honour a fully custom fallback prop as before
    if (this.props.fallback) return this.props.fallback

    const { featureLabel = 'This section', showGoBack = false, boundaryId = 'unknown' } = this.props
    const { error, showDetails } = this.state
    const isDev = import.meta.env.DEV

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-boundary-id={boundaryId}
        className="flex flex-col items-center justify-center p-6 rounded-xl border border-red-800 bg-red-900/20 text-center gap-4 min-h-[180px]"
      >
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
          <svg
            className="w-6 h-6 text-red-500 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* Message */}
        <div>
          <h2 className="text-base font-semibold text-gray-100 mb-1">
            {featureLabel} encountered an error
          </h2>
          <p className="text-sm text-gray-400">
            Something went wrong rendering this section. Try retrying or go back.
          </p>
        </div>

        {/* Recovery actions */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer"
            aria-label={`Retry ${featureLabel}`}
          >
            Retry
          </button>

          {showGoBack && (
            <button
              type="button"
              onClick={this.handleGoBack}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer"
              aria-label="Go back to previous page"
            >
              Go back
            </button>
          )}

          {isDev && (
            <button
              type="button"
              onClick={this.toggleDetails}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer"
              aria-expanded={showDetails}
              aria-label="Toggle error details"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>

        {/* Collapsible error details (dev only) */}
        {isDev && showDetails && error && (
          <div className="w-full max-w-xl text-left">
            <pre className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </div>
        )}
      </div>
    )
  }
}

/**
 * Page-level ErrorBoundary – fills most of the viewport, includes "Go back".
 * Used to wrap individual lazy-loaded route components.
 */
export class PageErrorBoundary extends Component<
  Omit<ErrorBoundaryProps, 'showGoBack'>,
  ErrorBoundaryState
> {
  constructor(props: Omit<ErrorBoundaryProps, 'showGoBack'>) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PageErrorBoundary caught:', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false })
  }

  private handleGoBack = () => {
    window.history.back()
  }

  private toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    const { featureLabel = 'This page', boundaryId = 'page' } = this.props
    const { error, showDetails } = this.state
    const isDev = import.meta.env.DEV

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-boundary-id={boundaryId}
        className="min-h-[60vh] flex items-center justify-center p-4"
      >
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {featureLabel} failed to load
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            An unexpected error occurred. You can retry or go back to the previous page.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer"
              aria-label={`Retry loading ${featureLabel}`}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={this.handleGoBack}
              className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              aria-label="Go back to previous page"
            >
              Go back
            </button>
          </div>

          {isDev && (
            <button
              type="button"
              onClick={this.toggleDetails}
              className="text-xs text-gray-400 hover:text-gray-200 underline cursor-pointer"
              aria-expanded={showDetails}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}

          {isDev && showDetails && error && (
            <div className="mt-3 text-left">
              <pre className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }
}

/**
 * Hook that installs global handlers for errors that React error boundaries
 * cannot catch: unhandled promise rejections and uncaught synchronous errors
 * thrown outside of React's render cycle (e.g. in event handlers, timers, or
 * third-party callbacks).
 *
 * Mount this once near the root of the application (e.g. inside `<App>`).
 * The handlers are automatically removed when the component unmounts.
 *
 * @param onError - Optional callback invoked with every captured error.
 *   Defaults to `console.error`.
 *
 * @example
 * ```tsx
 * function App() {
 *   useGlobalErrorHandler((err) => reportToMonitoring(err))
 *   return <RouterProvider ... />
 * }
 * ```
 */
export function useGlobalErrorHandler(
  onError?: (error: Error) => void,
): void {
  useEffect(() => {
    const report = onError ?? ((err: Error) => console.error('Unhandled error:', err))

    const handleError = (event: ErrorEvent) => {
      report(event.error instanceof Error ? event.error : new Error(event.message))
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const error = reason instanceof Error ? reason : new Error(String(reason))
      report(error)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [onError])
}
