/**
 * Sentry Error Tracking Integration
 *
 * Initializes Sentry for production error tracking and monitoring.
 * Handles environment configuration, performance monitoring, and safe initialization.
 *
 * Note: @sentry/react is an optional dependency. Install with:
 * npm install @sentry/react
 *
 * Usage:
 * ```tsx
 * import { initSentry } from './utils/sentry'
 *
 * // Call early in main.tsx before rendering
 * initSentry()
 * ```
 */

export interface SentryConfig {
  enabled: boolean
  dsn: string
  environment: string
  debug: boolean
  tracesSampleRate: number
  attachStacktrace: boolean
  maxBreadcrumbs: number
}

let sentryInitialized = false

/**
 * Get Sentry configuration from environment variables.
 * Returns a safe default config if Sentry is not configured.
 */
export function getSentryConfig(): SentryConfig {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  const environment = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'unknown'
  const debug = import.meta.env.VITE_SENTRY_DEBUG === 'true'
  const enabled = !!dsn

  return {
    enabled,
    dsn: dsn || '',
    environment,
    debug,
    tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string)
      : 0.1, // 10% by default
    attachStacktrace: true,
    maxBreadcrumbs: 100,
  }
}

/**
 * Initialize Sentry for error tracking.
 * Safe to call multiple times (idempotent).
 *
 * @returns true if Sentry was initialized, false if disabled or already initialized
 */
export async function initSentry(): Promise<boolean> {
  const config = getSentryConfig()

  if (!config.enabled) {
    if (config.debug) {
      console.log('Sentry disabled: VITE_SENTRY_DSN not configured')
    }
    return false
  }

  if (sentryInitialized) {
    return true
  }

  try {
    const Sentry = await import('@sentry/react')

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      debug: config.debug,
      tracesSampleRate: config.tracesSampleRate,
      attachStacktrace: config.attachStacktrace,
      maxBreadcrumbs: config.maxBreadcrumbs,

      // Ignore specific errors that are not actionable
      ignoreErrors: [
        // Browser extensions and user script errors
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',

        // Known harmless errors
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',

        // Network errors that may be expected in unstable networks
        'NetworkError',
        'Network request failed',
      ],

      // Capture replays for errors
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
    })

    sentryInitialized = true

    if (config.debug) {
      console.log(`Sentry initialized for environment: ${config.environment}`)
    }

    return true
  } catch (error) {
    if (config.debug) {
      console.debug('Sentry SDK not available or failed to initialize:', error)
    }
    return false
  }
}

/**
 * Set user context for error reporting.
 * Call this after user authentication.
 */
export function setSentryUser(userId: string, email?: string, username?: string): void {
  if (!getSentryConfig().enabled) return

  try {
    import('@sentry/react').then((Sentry) => {
      Sentry.setUser({
        id: userId,
        email,
        username,
      })
    }).catch(() => {
      // Sentry not available
    })
  } catch {
    // Sentry not available
  }
}

/**
 * Clear user context (e.g., on logout).
 */
export function clearSentryUser(): void {
  if (!getSentryConfig().enabled) return

  try {
    import('@sentry/react').then((Sentry) => {
      Sentry.setUser(null)
    }).catch(() => {
      // Sentry not available
    })
  } catch {
    // Sentry not available
  }
}

/**
 * Set custom context tags for error reporting.
 */
export function setSentryContext(
  name: string,
  context: Record<string, unknown>,
): void {
  if (!getSentryConfig().enabled) return

  try {
    import('@sentry/react').then((Sentry) => {
      Sentry.setContext(name, context)
    }).catch(() => {
      // Sentry not available
    })
  } catch {
    // Sentry not available
  }
}

/**
 * Add a breadcrumb for debugging.
 */
export function addSentryBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
): void {
  if (!getSentryConfig().enabled) return

  try {
    import('@sentry/react').then((Sentry) => {
      Sentry.addBreadcrumb({
        message,
        data,
        level: level as any,
        category: 'user-action',
      })
    }).catch(() => {
      // Sentry not available
    })
  } catch {
    // Sentry not available
  }
}

/**
 * Capture an error with additional context.
 */
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>,
): string {
  if (!getSentryConfig().enabled) {
    console.error('Error captured (Sentry disabled):', error, context)
    return 'error-not-reported'
  }

  try {
    let eventId = 'unknown'
    import('@sentry/react').then((Sentry) => {
      eventId = Sentry.captureException(error, {
        contexts: {
          app: context,
        },
      })
    }).catch(() => {
      console.error('Failed to capture error with Sentry:', error)
    })
    return eventId
  } catch (err) {
    console.error('Error in captureError:', err)
    return 'error-capture-failed'
  }
}

/**
 * Capture a message (non-error).
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
): string {
  if (!getSentryConfig().enabled) {
    console.log(`Message captured (Sentry disabled): ${message}`)
    return 'message-not-reported'
  }

  try {
    let eventId = 'unknown'
    import('@sentry/react').then((Sentry) => {
      eventId = Sentry.captureMessage(message, level)
    }).catch(() => {
      console.log('Failed to capture message with Sentry:', message)
    })
    return eventId
  } catch (err) {
    console.error('Error in captureMessage:', err)
    return 'message-capture-failed'
  }
}

/**
 * Manually trigger error reporting (for testing).
 */
export function testSentryErrorReporting(): void {
  throw new Error('Test error from Sentry integration')
}
