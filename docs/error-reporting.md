# Error Reporting Infrastructure — Sentry Integration

## Overview

The Stellar Oracle frontend now includes comprehensive error reporting with Sentry integration. This ensures production errors are automatically tracked, monitored, and alerted to the team—no manual user reports needed.

## Features

✅ **Automatic Error Tracking** — All errors automatically reported to Sentry  
✅ **Network Monitoring** — HTTP errors and timeouts tracked with context  
✅ **User Context** — Link errors to specific users for support  
✅ **Breadcrumb Logging** — Trace user actions leading to errors  
✅ **Performance Monitoring** — Track slow operations and Core Web Vitals  
✅ **Custom Contexts** — Add domain-specific metadata to errors  
✅ **Error Boundaries** — React component error tracking  
✅ **Local Storage** — Store recent errors for offline debugging  
✅ **Non-Blocking** — Error reporting never breaks the app  

## Architecture

### Components

**`src/utils/sentry.ts`** — Core Sentry integration
- `initSentry()`: Initialize Sentry with config
- `getSentryConfig()`: Read config from env vars
- `setSentryUser/clearSentryUser()`: Track user context
- `addSentryBreadcrumb()`: Log user actions
- `captureError/captureMessage()`: Report errors/messages

**`src/utils/errorReporting.ts`** — High-level error API
- `reportError()`: Main error reporting function
- `withErrorHandler()`: Wrap async operations
- `trackAsyncOperation()`: Time and track operations
- Domain handlers: `reportNetworkError()`, `reportApiError()`, `reportWebSocketError()`, `reportIndexedDBError()`
- Local storage: `getStoredErrorReports()`, `exportErrorReports()`

**`src/utils/errorTrackingIntegration.ts`** — System integrations
- `setupErrorTracking()`: Initialize all tracking
- `setupNetworkErrorTracking()`: Intercept fetch
- `setupStorageErrorTracking()`: Monitor IndexedDB
- `setupUnhandledRejectionTracking()`: Catch promise rejections
- `setupPerformanceMonitoring()`: Track slow operations

**`src/components/ErrorBoundaryWithSentry.tsx`** — React error boundary
- Catches render errors
- Reports to Sentry
- User-friendly fallback UI
- Recovery options (retry, go back)

**`src/hooks/useErrorReporting.ts`** — React hook
- Component-level error reporting
- Type-safe error handlers
- Integrated context tracking

## Configuration

### Environment Variables

Set these in your `.env` file (or CI/CD environment):

```bash
# Enable Sentry error tracking
VITE_SENTRY_DSN=https://your-key@sentry.io/project-id

# Environment name (production, staging, development)
VITE_SENTRY_ENV=production

# Enable debug logging (development only)
VITE_SENTRY_DEBUG=false

# Sample rate for performance monitoring (0-1)
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

### How to Get Sentry DSN

1. Create a [Sentry account](https://sentry.io)
2. Create a new project (select "React" as platform)
3. Copy the DSN from Project Settings → Client Keys (DSN)
4. Add to your environment variables

### Disabling Sentry

Leave `VITE_SENTRY_DSN` unset to disable Sentry. All error reporting functions become no-ops with warnings logged to console.

## Usage

### Basic Error Reporting

```typescript
import { reportError } from './utils/errorReporting'

try {
  const data = await fetchData()
} catch (error) {
  reportError(error, {
    context: { operation: 'fetch-data' },
    tags: { service: 'api' },
    level: 'error',
  })
}
```

### In React Components

```typescript
import { useErrorReporting } from './hooks/useErrorReporting'

export function MyComponent() {
  const { reportError, withHandler, track } = useErrorReporting({
    componentName: 'MyComponent',
  })

  // Wrap async operations
  const handleClick = withHandler(async () => {
    const data = await fetchData()
    return data
  }, { operation: 'fetch-on-click' })

  // Track timed operations
  const handleLoad = () => {
    track('data-load', async () => {
      return await expensiveOperation()
    })
  }

  // Manual error reporting
  const handleError = () => {
    reportError(new Error('Something broke'), {
      notifyUser: true,
    })
  }

  return (
    <>
      <button onClick={handleClick}>Fetch</button>
      <button onClick={handleLoad}>Load</button>
      <button onClick={handleError}>Error</button>
    </>
  )
}
```

### Error Boundaries

```typescript
import { ErrorBoundaryWithSentry } from './components/ErrorBoundaryWithSentry'

export function App() {
  return (
    <ErrorBoundaryWithSentry
      boundaryId="dashboard"
      featureLabel="Dashboard"
    >
      <Dashboard />
    </ErrorBoundaryWithSentry>
  )
}
```

### Network Errors

```typescript
import { reportNetworkError } from './utils/errorReporting'

fetch('/api/prices')
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return res.json()
  })
  .catch(error => {
    reportNetworkError(error, {
      url: '/api/prices',
      status: error.status,
    })
  })
```

### API Errors

```typescript
import { reportApiError } from './utils/errorReporting'

try {
  const response = await fetch('/api/prices')
  const data = await response.json()
} catch (error) {
  reportApiError(error, {
    endpoint: '/api/prices',
    method: 'GET',
  })
}
```

### WebSocket Errors

```typescript
import { reportWebSocketError } from './utils/errorReporting'

const ws = new WebSocket('ws://localhost:3000')

ws.onerror = (event) => {
  reportWebSocketError('WebSocket error', {
    url: 'ws://localhost:3000',
    event: event.type,
  })
}
```

### IndexedDB Errors

```typescript
import { reportIndexedDBError } from './utils/errorReporting'

try {
  const db = await idbCache.get('prices', 'XLMBTC')
} catch (error) {
  reportIndexedDBError(error, {
    operation: 'read',
    storeName: 'prices',
    dbName: 'stellar-oracle',
  })
}
```

### Performance Tracking

```typescript
import { trackAsyncOperation, reportPerformanceIssue } from './utils/errorReporting'

// Track with automatic timing
const { result, duration, error } = await trackAsyncOperation(
  'fetch-prices',
  () => fetch('/api/prices').then(r => r.json()),
)

// Manual performance reporting
if (duration > 5000) {
  reportPerformanceIssue('fetch-prices', duration, 5000)
}
```

### User Context

```typescript
import { setSentryUser, clearSentryUser } from './utils/sentry'

// After user logs in
setSentryUser('user-123', 'user@example.com', 'johndoe')

// After user logs out
clearSentryUser()
```

### Custom Breadcrumbs

```typescript
import { addSentryBreadcrumb } from './utils/sentry'

// Log user actions
addSentryBreadcrumb('User clicked toggle', { setting: 'darkMode' }, 'info')

// Log important events
addSentryBreadcrumb('Price update received', { count: 42 }, 'info')
```

## Initialization

### In `main.tsx`

```typescript
import { initSentry } from './utils/sentry'
import { setupErrorTracking } from './utils/errorTrackingIntegration'

// Initialize Sentry early
initSentry()

// Set up all error tracking integrations
setupErrorTracking()

// Then render app
createRoot(root).render(<App />)
```

### In `App.tsx`

```typescript
import { ErrorBoundaryWithSentry } from './components/ErrorBoundaryWithSentry'
import { useEffect } from 'react'
import { setSentryUser } from './utils/sentry'

export function App() {
  useEffect(() => {
    // Set user after authentication
    if (currentUser) {
      setSentryUser(currentUser.id, currentUser.email)
    }
  }, [currentUser])

  return (
    <ErrorBoundaryWithSentry boundaryId="root">
      <Router>
        {/* app content */}
      </Router>
    </ErrorBoundaryWithSentry>
  )
}
```

## Error Categories

### Network Errors

Tracked when:
- Fetch fails (network unreachable)
- HTTP error status (4xx, 5xx)
- Response parsing fails
- Timeout occurs

Reported via: `reportNetworkError()`

### API Errors

Tracked when:
- API endpoint returns error status
- Response validation fails
- API timeout

Reported via: `reportApiError()`

### WebSocket Errors

Tracked when:
- Connection fails
- Message parsing fails
- Connection drops unexpectedly

Reported via: `reportWebSocketError()`

### Storage Errors

Tracked when:
- IndexedDB operations fail
- Storage quota exceeded
- Data corruption detected

Reported via: `reportIndexedDBError()`

### Performance Issues

Tracked when:
- Operation exceeds threshold
- Request takes >5 seconds
- Database operation takes >1 second
- UI frame rate drops

Reported via: `reportPerformanceIssue()`

## Local Error Storage

Recent errors are stored locally for debugging:

```typescript
import { getStoredErrorReports, exportErrorReports } from './utils/errorReporting'

// Get stored errors
const errors = getStoredErrorReports()

// Export as JSON for support
const json = exportErrorReports()
console.save(json, 'error-report.json')
```

Max 50 errors stored locally. Older errors are discarded.

## Best Practices

### DO

✅ Report errors as close to the source as possible  
✅ Include relevant context (component, operation, user)  
✅ Use domain-specific handlers (`reportNetworkError()`, etc.)  
✅ Add breadcrumbs for important user actions  
✅ Set user context after authentication  
✅ Use custom error boundaries per feature  
✅ Test error reporting in staging before production  
✅ Review Sentry dashboard regularly  

### DON'T

❌ Report the same error multiple times  
❌ Log sensitive data (passwords, tokens, PII)  
❌ Let error reporting block user interactions  
❌ Disable error reporting in production  
❌ Ignore Sentry alerts  

## Sentry Dashboard

### Viewing Errors

1. Log in to [Sentry](https://sentry.io)
2. Select your project
3. View "Issues" tab to see all errors
4. Click on an issue to see details:
   - Stack trace
   - User context
   - Breadcrumbs
   - System info
   - Similar issues

### Setting Up Alerts

1. Go to "Alerts" tab
2. Click "Create Alert Rule"
3. Configure:
   - Trigger: Error level, frequency
   - Filter: Environment, error type
   - Action: Email, Slack, PagerDuty

### Performance Monitoring

1. Go to "Performance" tab
2. View transaction durations
3. Identify slow endpoints
4. Set performance thresholds

## Testing

### Manual Testing

```typescript
import { testSentryErrorReporting } from './utils/sentry'

// Throw a test error
testSentryErrorReporting()
```

### In Development

With `VITE_SENTRY_DEBUG=true`, see debug logs in console:

```
Sentry initialized for environment: development
[ErrorReport err-1693012345000-abc123] Error: Test error
```

### Verify Installation

1. Set `VITE_SENTRY_DEBUG=true`
2. Start dev server: `npm run dev`
3. Check console for initialization message
4. Throw a test error
5. See error in Sentry dashboard within 1 minute

## Troubleshooting

### Errors not appearing in Sentry

**Check:**
- Is `VITE_SENTRY_DSN` set?
- Is the DSN valid?
- Is `initSentry()` called before rendering?
- Check browser console for errors
- Check network tab for Sentry requests

**Solution:**
```typescript
import { getSentryConfig } from './utils/sentry'

console.log(getSentryConfig())  // Check config
```

### Too many errors reported

**Reduce sample rate:**
```bash
VITE_SENTRY_TRACES_SAMPLE_RATE=0.01  # 1% instead of 10%
```

**Ignore known errors:**
Edit `ignoreErrors` in `src/utils/sentry.ts`

### Sensitive data in error reports

**Mask data:**
Set `maskAllText: true` in Sentry config (already enabled)

**Or explicitly mask:**
```typescript
reportError(error, {
  context: {
    // Don't include passwords, tokens, etc.
    email: 'user@example.com',  // OK
  },
})
```

## Support

- [Sentry Documentation](https://docs.sentry.io/)
- [Sentry React Integration](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)

## Examples

### Complete Error Handling Flow

```typescript
// 1. Initialize (main.tsx)
initSentry()
setupErrorTracking()
setSentryUser(userId)

// 2. Wrap operations (component)
const { reportError, withHandler } = useErrorReporting({
  componentName: 'PriceCard'
})

const loadPrices = withHandler(async () => {
  return await fetch('/api/prices').then(r => r.json())
})

// 3. Error boundary (layout)
<ErrorBoundaryWithSentry boundaryId="dashboard">
  <Dashboard />
</ErrorBoundaryWithSentry>

// 4. Monitor in Sentry
// - Errors appear in dashboard
// - Breadcrumbs show user actions
// - User context links to specific user
// - Performance metrics tracked
```

## References

- [Sentry Setup Guide](https://docs.sentry.io/product/integrations/integration-platform/setup/)
- [Error Reporting Best Practices](https://docs.sentry.io/product/best-practices/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
