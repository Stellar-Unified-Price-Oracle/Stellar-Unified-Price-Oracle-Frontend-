/**
 * Sentry-Integrated React Error Boundary
 *
 * Enhanced error boundary that reports errors to Sentry and provides
 * user-friendly fallback UI with recovery options.
 *
 * @example
 * ```tsx
 * import { ErrorBoundaryWithSentry } from './components/ErrorBoundaryWithSentry'
 *
 * <ErrorBoundaryWithSentry boundaryId="dashboard" fallback={<ErrorFallback />}>
 *   <Dashboard />
 * </ErrorBoundaryWithSentry>
 * ```
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError, createErrorContext } from '../utils/errorReporting'
import { addSentryBreadcrumb } from '../utils/sentry'

export interface SentryErrorBoundaryProps {
  children: ReactNode
  boundaryId?: string
  featureLabel?: string
  showDetails?: boolean
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode)
}

export interface FallbackProps {
  error: Error
  componentStack: string
  resetError: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  sentryEventId: string | null
}

/**
 * Error boundary with Sentry integration for comprehensive error tracking.
 */
export class ErrorBoundaryWithSentry extends Component<SentryErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: SentryErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: props.showDetails ?? import.meta.env.DEV,
      sentryEventId: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Store error info
    this.setState({ errorInfo })

    // Create context for this error
    const context = createErrorContext(this.props.boundaryId || 'unknown-boundary', {
      componentStack: errorInfo.componentStack || '',
      featureLabel: this.props.featureLabel,
    })

    // Report to Sentry
    const eventId = reportError(error, {
      context,
      level: 'error',
    })

    this.setState({ sentryEventId: eventId })

    // Add breadcrumb
    addSentryBreadcrumb(`Error boundary caught: ${this.props.featureLabel || 'Unknown'}`, {
      boundaryId: this.props.boundaryId,
      error: error.message,
      componentStack: (errorInfo.componentStack || '').slice(0, 500), // Truncate for breadcrumb
    })

    // Call optional external handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo)
      } catch (handlerError) {
        console.error('Error in onError handler:', handlerError)
      }
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('React Error Boundary caught:', error)
      console.error('Component Stack:', errorInfo.componentStack)
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: import.meta.env.DEV,
      sentryEventId: null,
    })

    addSentryBreadcrumb('Error boundary reset by user')
  }

  handleShowDetails = (): void => {
    this.setState((prev) => ({
      showDetails: !prev.showDetails,
    }))
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error, errorInfo, showDetails, sentryEventId } = this.state
    const { fallback, featureLabel = 'This section', boundaryId } = this.props

    // Custom fallback component
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback({
          error: error!,
          componentStack: errorInfo?.componentStack || '',
          resetError: this.handleReset,
        })
      }
      return fallback
    }

    // Default fallback UI
    return (
      <div
        className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 p-6 text-red-900"
        role="alert"
      >
        <div className="w-full max-w-md">
          <h2 className="mb-2 text-lg font-semibold text-red-700">Something went wrong</h2>
          <p className="mb-4 text-sm text-red-600">
            An error occurred in {featureLabel}. Our team has been notified.
          </p>

          {sentryEventId && sentryEventId !== 'error-not-reported' && (
            <p className="mb-3 text-xs font-mono text-red-500">
              Reference: <span className="break-all">{sentryEventId}</span>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={this.handleReset}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Try again
            </button>

            {import.meta.env.DEV && (
              <button
                onClick={this.handleShowDetails}
                className="rounded border border-red-400 bg-transparent px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100/10"
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
            )}

            <button
              onClick={() => window.history.back()}
              className="rounded border border-red-400 bg-transparent px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100/10"
            >
              Go back
            </button>
          </div>

          {showDetails && errorInfo && (
            <div className="mt-4 space-y-2">
              <details className="cursor-pointer">
                <summary className="text-xs font-semibold text-red-600">Error details</summary>
                <pre className="mt-2 overflow-auto rounded bg-red-950/20 p-2 text-xs text-red-700">
                  {error?.message}
                </pre>
              </details>

              <details className="cursor-pointer">
                <summary className="text-xs font-semibold text-red-600">Component stack</summary>
                <pre className="mt-2 overflow-auto rounded bg-red-950/20 p-2 text-xs text-red-700">
                  {errorInfo.componentStack}
                </pre>
              </details>

              {boundaryId && (
                <p className="mt-2 text-xs text-red-500">
                  Boundary ID: <code>{boundaryId}</code>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
