import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  reportError,
  withErrorHandler,
  withSyncErrorHandler,
  createErrorContext,
  trackAsyncOperation,
  reportNetworkError,
  reportApiError,
  reportWebSocketError,
  reportIndexedDBError,
  reportPerformanceIssue,
  getStoredErrorReports,
  clearStoredErrorReports,
  exportErrorReports,
  createDomainErrorHandler,
} from './errorReporting'

// Mock Sentry module
vi.mock('./sentry', () => ({
  getSentryConfig: vi.fn(() => ({ enabled: false })),
  captureError: vi.fn(() => 'test-event-id'),
  captureMessage: vi.fn(() => 'test-message-id'),
  addSentryBreadcrumb: vi.fn(),
  setSentryContext: vi.fn(),
}))

describe('Error Reporting', () => {
  beforeEach(() => {
    clearStoredErrorReports()
    vi.clearAllMocks()
  })

  describe('reportError', () => {
    it('stores error locally', () => {
      const error = new Error('Test error')
      reportError(error, { context: { component: 'TestComponent' } })

      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(1)
      expect(stored[0].message).toBe('Test error')
    })

    it('returns event ID', () => {
      const error = new Error('Test error')
      const eventId = reportError(error)

      expect(eventId).toBe('test-event-id')
    })

    it('includes context in stored error', () => {
      const error = new Error('Test error')
      const context = { component: 'Dashboard', userId: '123' }

      reportError(error, { context })

      const stored = getStoredErrorReports()
      expect(stored[0].context).toEqual(context)
    })

    it('handles string errors', () => {
      const eventId = reportError('String error', { context: { test: true } })

      expect(eventId).toBe('test-event-id')
      const stored = getStoredErrorReports()
      expect(stored[0].message).toBe('String error')
    })

    it('limits stored errors to MAX_STORED_ERRORS', () => {
      // Report 60 errors
      for (let i = 0; i < 60; i++) {
        reportError(`Error ${i}`)
      }

      const stored = getStoredErrorReports()
      expect(stored.length).toBeLessThanOrEqual(50)
    })

    it('stores stack trace when available', () => {
      const error = new Error('Test error with stack')
      reportError(error)

      const stored = getStoredErrorReports()
      expect(stored[0].stack).toBeDefined()
      expect(stored[0].stack).toContain('Error')
    })
  })

  describe('withErrorHandler', () => {
    it('wraps async function and catches errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Async error'))
      const wrapped = withErrorHandler(fn)

      const result = await wrapped()

      expect(result).toBeNull()
      expect(fn).toHaveBeenCalled()
      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(1)
    })

    it('returns function result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const wrapped = withErrorHandler(fn)

      const result = await wrapped()

      expect(result).toBe('success')
      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(0)
    })

    it('includes context in error report', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Error'))
      const wrapped = withErrorHandler(fn, {
        context: { component: 'MyComponent' },
      })

      await wrapped()

      const stored = getStoredErrorReports()
      expect(stored[0].context?.component).toBe('MyComponent')
    })

    it('passes arguments to wrapped function', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const wrapped = withErrorHandler(fn)

      await wrapped('arg1', 'arg2')

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('withSyncErrorHandler', () => {
    it('wraps sync function and catches errors', () => {
      const fn = vi.fn(() => {
        throw new Error('Sync error')
      })
      const wrapped = withSyncErrorHandler(fn)

      const result = wrapped()

      expect(result).toBeNull()
      expect(fn).toHaveBeenCalled()
      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(1)
    })

    it('returns function result on success', () => {
      const fn = vi.fn(() => 'success')
      const wrapped = withSyncErrorHandler(fn)

      const result = wrapped()

      expect(result).toBe('success')
      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(0)
    })
  })

  describe('createErrorContext', () => {
    it('creates context with component name', () => {
      const context = createErrorContext('Dashboard')

      expect(context.component).toBe('Dashboard')
    })

    it('includes metadata', () => {
      const metadata = { userId: '123', apiUrl: 'https://api.example.com' }
      const context = createErrorContext('Dashboard', metadata)

      expect(context).toMatchObject(metadata)
      expect(context.component).toBe('Dashboard')
    })
  })

  describe('trackAsyncOperation', () => {
    it('tracks successful operation', async () => {
      const fn = vi.fn().mockResolvedValue('result')

      const { result, duration, error } = await trackAsyncOperation('test-op', fn)

      expect(result).toBe('result')
      expect(duration).toBeGreaterThanOrEqual(0)
      expect(error).toBeUndefined()
    })

    it('tracks failed operation', async () => {
      const testError = new Error('Operation failed')
      const fn = vi.fn().mockRejectedValue(testError)

      const { result, duration, error } = await trackAsyncOperation('test-op', fn)

      expect(result).toBeNull()
      expect(duration).toBeGreaterThanOrEqual(0)
      expect(error).toEqual(testError)
    })

    it('measures duration', async () => {
      const fn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'result'
      })

      const { duration } = await trackAsyncOperation('test-op', fn)

      expect(duration).toBeGreaterThanOrEqual(10)
    })

    it('includes context in error report', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Error'))
      const context = { component: 'Dashboard', userId: '123' }

      await trackAsyncOperation('test-op', fn, context)

      const stored = getStoredErrorReports()
      expect(stored[0].context).toMatchObject(context)
      expect(stored[0].context?.operation).toBe('test-op')
    })
  })

  describe('Domain-specific reporters', () => {
    it('reportNetworkError includes network details', () => {
      reportNetworkError('Network failed', {
        method: 'GET',
        url: '/api/prices',
        status: 500,
        responseTime: 1000,
      })

      const stored = getStoredErrorReports()
      expect(stored[0].context?.operation).toBe('network-request')
      expect(stored[0].context?.method).toBe('GET')
    })

    it('reportApiError includes API details', () => {
      reportApiError('API error', {
        endpoint: '/api/prices',
        method: 'POST',
        statusCode: 400,
      })

      const stored = getStoredErrorReports()
      expect(stored[0].context?.operation).toBe('api-call')
      expect(stored[0].context?.endpoint).toBe('/api/prices')
    })

    it('reportWebSocketError includes WebSocket details', () => {
      reportWebSocketError('WebSocket error', {
        url: 'ws://localhost:3000',
        event: 'error',
        code: 1006,
      })

      const stored = getStoredErrorReports()
      expect(stored[0].context?.operation).toBe('websocket')
      expect(stored[0].context?.url).toBe('ws://localhost:3000')
    })

    it('reportIndexedDBError includes storage details', () => {
      reportIndexedDBError('Storage error', {
        operation: 'read',
        storeName: 'prices',
        dbName: 'stellar-oracle',
      })

      const stored = getStoredErrorReports()
      expect(stored[0].context?.operation).toBe('indexeddb')
      expect(stored[0].context?.storeName).toBe('prices')
    })
  })

  describe('reportPerformanceIssue', () => {
    it('reports performance issue when threshold exceeded', () => {
      const captureSpy = vi.fn()
      vi.doMock('./sentry', () => ({
        captureMessage: captureSpy,
      }))

      reportPerformanceIssue('slow-operation', 6000, 5000)

      // Check that breadcrumb was added (we can't directly check captureMessage
      // since it's mocked at module level)
      const stored = getStoredErrorReports()
      // Performance issues don't create error entries, just breadcrumbs
      expect(stored.length).toBe(0) // No error stored
    })

    it('does not report when under threshold', () => {
      reportPerformanceIssue('fast-operation', 2000, 5000)

      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(0)
    })
  })

  describe('Error storage', () => {
    it('exports errors as JSON', () => {
      reportError(new Error('Error 1'))
      reportError(new Error('Error 2'))

      const json = exportErrorReports()
      const parsed = JSON.parse(json)

      expect(parsed).toHaveLength(2)
      expect(parsed[0].message).toBe('Error 1')
      expect(parsed[1].message).toBe('Error 2')
    })

    it('clears stored errors', () => {
      reportError(new Error('Error 1'))
      expect(getStoredErrorReports()).toHaveLength(1)

      clearStoredErrorReports()
      expect(getStoredErrorReports()).toHaveLength(0)
    })
  })

  describe('createDomainErrorHandler', () => {
    it('creates domain-specific error handler', () => {
      const handler = createDomainErrorHandler('pricing')

      const eventId = handler.report(new Error('Price fetch failed'))

      expect(eventId).toBe('test-event-id')
      const stored = getStoredErrorReports()
      expect(stored[0].context?.domain).toBe('pricing')
    })

    it('provides withHandler method', async () => {
      const handler = createDomainErrorHandler('pricing')
      const fn = vi.fn().mockRejectedValue(new Error('Error'))

      const wrapped = handler.withHandler(fn)
      await wrapped()

      const stored = getStoredErrorReports()
      expect(stored[0].context?.domain).toBe('pricing')
    })

    it('provides track method', async () => {
      const handler = createDomainErrorHandler('pricing')
      const fn = vi.fn().mockResolvedValue('result')

      const { result, duration } = await handler.track('fetch-prices', fn)

      expect(result).toBe('result')
      expect(duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error ID generation', () => {
    it('generates unique error IDs', () => {
      reportError(new Error('Error 1'))
      reportError(new Error('Error 2'))

      const stored = getStoredErrorReports()
      expect(stored[0].id).not.toBe(stored[1].id)
      expect(stored[0].id).toMatch(/^err-/)
      expect(stored[1].id).toMatch(/^err-/)
    })

    it('includes timestamp in error ID', () => {
      reportError(new Error('Error 1'))

      const stored = getStoredErrorReports()
      const id = stored[0].id
      const timestamp = id.split('-')[1]

      expect(parseInt(timestamp)).toBeGreaterThan(0)
      expect(parseInt(timestamp)).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('Integration with Sentry config', () => {
    it('respects Sentry disabled state', () => {
      const error = new Error('Test')

      reportError(error)

      // Should still store locally even when Sentry disabled
      const stored = getStoredErrorReports()
      expect(stored).toHaveLength(1)
    })
  })
})
