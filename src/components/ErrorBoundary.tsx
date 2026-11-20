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
 * - **Context actions** — caller-supplied `recoveryActions` (e.g. "Switch to card
 *   view"). Each runs its callback and then retries the subtree, so the fix takes
 *   effect immediately (#818).
 * - **Show details** — toggles the raw error message. Visible in development
 *   (`import.meta.env.DEV`) and hidden in production builds.
 *
 * ## Error categories (#867)
 * The fallback copy adapts to the known API error category so users get
 * actionable recovery guidance instead of a generic message. Categories are
 * inferred from the caught error (see {@link classifyErrorCategory}) or can be
 * supplied explicitly via the `errorCategory` prop when the caller already
 * knows the failure kind (e.g. from a fetch response status).
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

/**
 * Known API error categories that drive user-facing recovery copy (#867).
 * `unknown` is the fallback when the failure cannot be classified.
 */
export type ApiErrorCategory =
  | 'network'
  | 'timeout'
  | 'rate-limit'
  | 'auth'
  | 'not-found'
  | 'server'
  | 'validation'
  | 'stale'
  | 'unknown'

/** User-facing recovery copy for a single error category. */
export interface ErrorCategoryCopy {
  /** Short heading shown in the fallback. */
  title: string
  /** One-sentence explanation of what happened. */
  message: string
  /** Suggested next step for the user. */
  recovery: string
}

/**
 * Recovery copy for every known API error category (#867).
 * Keep messages plain-language, non-blaming, and actionable.
 */
export const ERROR_CATEGORY_COPY: Record<ApiErrorCategory, ErrorCategoryCopy> = {
  network: {
    title: 'Connection problem',
    message: 'We could not reach the price service. Your connection may be offline.',
    recovery: 'Check your connection, then retry.',
  },
  timeout: {
    title: 'Request timed out',
    message: 'The price service took too long to respond.',
    recovery: 'Retry in a moment. If it keeps timing out, try again later.',
  },
  'rate-limit': {
    title: 'Too many requests',
    message: 'We are being rate limited by the price service.',
    recovery: 'Wait a few seconds, then retry.',
  },
  auth: {
    title: 'Sign-in required',
    message: 'Your session is missing or has expired.',
    recovery: 'Sign in again, then retry.',
  },
  'not-found': {
    title: 'Not found',
    message: 'The requested price data could not be found.',
    recovery: 'Go back and choose a different asset or market.',
  },
  server: {
    title: 'Service error',
    message: 'The price service ran into an unexpected problem.',
    recovery: 'Retry shortly. If it persists, check the status page.',
  },
  validation: {
    title: 'Invalid request',
    message: 'Some of the requested data was not valid.',
    recovery: 'Adjust your selection and retry.',
  },
  stale: {
    title: 'Data may be out of date',
    message: 'We are showing the last known prices because fresh data is unavailable.',
    recovery: 'Retry to refresh, or continue with the last known values.',
  },
  unknown: {
    title: 'Something went wrong',
    message: 'Something went wrong rendering this section.',
    recovery: 'Try retrying or go back.',
  },
}

/**
 * Best-effort classification of a caught error into a known API category.
 * Inspects common error shapes (message text, `status`/`code` fields) without
 * fabricating upstream data. Returns `'unknown'` when nothing matches.
 */
export function classifyErrorCategory(error: unknown): ApiErrorCategory {
  if (!error || typeof error !== 'object') return 'unknown'
  const err = error as { status?: number; code?: string; name?: string; message?: string }
  const status = typeof err.status === 'number' ? err.status : undefined
  const code = (err.code ?? '').toLowerCase()
  const name = (err.name ?? '').toLowerCase()
  const message = (err.message ?? '').toLowerCase()

  if (status === 401 || status === 403 || code === 'unauthorized' || code === 'forbidden') return 'auth'
  if (status === 404 || code === 'not_found') return 'not-found'
  if (status === 429 || code === 'rate_limited') return 'rate-limit'
  if (status === 408 || name === 'timeouterror' || message.includes('timeout')) return 'timeout'
  if (status === 422 || code === 'validation_error') return 'validation'
  if (status !== undefined && status >= 500) return 'server'
  if (name === 'typeerror' && message.includes('fetch')) return 'network'
  if (message.includes('network') || message.includes('offline')) return 'network'
  if (message.includes('stale')) return 'stale'
  return 'unknown'
}

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
  /**
   * Panel-specific fixes shown after Retry, so the user can clear the likely
   * cause (e.g. a bad saved layout) instead of retrying blindly (#818).
   */
  recoveryActions?: ReadonlyArray<ErrorRecoveryAction>
  /**
   * Explicit API error category. When omitted, the category is inferred from
   * the caught error via {@link classifyErrorCategory} (#867).
   */
  errorCategory?: ApiErrorCategory
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  showDetails: boolean
}

/** A panel-specific recovery step offered alongside Retry (#818). */
export interface ErrorRecoveryAction {
  /** Visible button text, e.g. "Switch to card view". */
  label: string
  /** Applies the fix. The boundary retries the subtree right after it runs. */
  onAction: () => void
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

    const {
      featureLabel = 'This section',
      showGoBack = false,
      boundaryId = 'unknown',
      recoveryActions = [],
      errorCategory,
    } = this.props
    const { error, showDetails } = this.state
    const isDev = import.meta.env.DEV

    // Resolve the user-facing recovery copy for the known API error category (#867).
    const category: ApiErrorCategory = errorCategory ?? classifyErrorCategory(error)
    const copy = ERROR_CATEGORY_COPY[category]

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-boundary-id={boundaryId}
        data-error-category={category}
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
            {featureLabel}: {copy.title}
          </h2>
          <p className="text-sm text-gray-400">{copy.message}</p>
          <p className="text-sm text-gray-400 mt-1">{copy.recovery}</p>
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

          {recoveryActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                action.onAction()
                this.handleRetry()
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer"
              aria-label={`${action.label} for ${featureLabel}`}
            >
              {action.label}
            </button>
          ))}

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

          {isDev && error && (
            <button
              type="button"
              onClick={this.toggleDetails}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer"
              aria-expanded={showDetails}
              aria-controls={`${boundaryId}-error-details`}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>

        {isDev && showDetails && error && (
          <pre
            id={`${boundaryId}-error-details`}
            className="w-full max-w-full overflow-auto text-left text-xs text-red-300 bg-black/30 rounded-lg p-3 whitespace-pre-wrap break-words"
          >
            {error.message}
          </pre>
        )}
      </div>
    )
  }
}

/**
 * Hook that reports async errors (event handlers, effects) to an external
 * reporter. Render-time errors are handled by {@link ErrorBoundary}.
 */
export function useErrorReporter() {
  return {
    report: (error: unknown, context?: Record<string, unknown>) => {
      console.error('Reported error:', error, context)
    },
  }
}

/**
 * Convenience wrapper that renders children inside an {@link ErrorBoundary}
 * with a stable boundary id derived from the feature label.
 */
export function withErrorBoundary<P extends object>(
  Wrapped: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>,
) {
  return function ErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary {...options}>
        <Wrapped {...props} />
      </ErrorBoundary>
    )
  }
}

/**
 * Small helper component that renders the recovery copy for a given category.
 * Useful for inline error states that are not render-time crashes.
 */
export function ErrorCategoryMessage({ category }: { category: ApiErrorCategory }) {
  const copy = ERROR_CATEGORY_COPY[category]
  return (
    <div role="status" aria-live="polite" data-error-category={category}>
      <p className="text-sm font-medium text-gray-100">{copy.title}</p>
      <p className="text-sm text-gray-400">{copy.message}</p>
      <p className="text-sm text-gray-400">{copy.recovery}</p>
    </div>
  )
}

/**
 * Kept for backwards compatibility with callers that imported the hook from
 * this module; re-exports the effect helper used by some panels.
 */
export function useOnMountEffect(effect: () => void) {
  useEffect(effect, [])
}
