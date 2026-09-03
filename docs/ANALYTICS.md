# Analytics Implementation Guide

## Overview

The Stellar Oracle frontend includes a privacy-focused analytics system that enables tracking of:
- **Page views and navigation**: Which pages users visit and how they navigate
- **Feature usage**: How users interact with exports, alerts, preferences, filters, and searches
- **Performance metrics**: Load times, Core Web Vitals, API response times, and resource usage
- **User engagement**: Panel interactions, keyboard shortcuts, API docs views

All analytics are **privacy-preserving** and respect browser privacy settings (DNT, Global Privacy Control).

## Privacy Guarantees

✅ **No personal identifying information (PII)** is collected  
✅ **Respects browser privacy headers** - DNT and Global Privacy Control  
✅ **User can opt-out** - Set `STORAGE_KEYS.analyticsOptOut` to disable all analytics  
✅ **Privacy-preserving providers** - Works with Plausible and Umami  
✅ **No third-party cookies** - Uses only first-party tracking  
✅ **Transparent configuration** - All settings via environment variables  

## Configuration

### Environment Variables

Set these in `.env` to enable analytics:

```bash
# Analytics provider: "plausible" | "umami" | "" (empty to disable)
VITE_ANALYTICS_PROVIDER=plausible

# Provider ID/domain
# - For Plausible: your domain (e.g., "example.com")
# - For Umami: your website ID
VITE_ANALYTICS_ID=example.com

# Optional: Custom endpoint for analytics events
# Leave blank to use provider only
VITE_ANALYTICS_URL=https://analytics.example.com/events
```

### Plausible Setup

1. Sign up at [plausible.io](https://plausible.io)
2. Add your domain to Plausible
3. Set `VITE_ANALYTICS_PROVIDER=plausible`
4. Set `VITE_ANALYTICS_ID` to your domain name
5. Build and deploy

### Umami Setup

1. Set up Umami instance (self-hosted or cloud)
2. Create a website entry in Umami
3. Get your website ID from Umami dashboard
4. Set `VITE_ANALYTICS_PROVIDER=umami`
5. Set `VITE_ANALYTICS_ID` to your website ID
6. Build and deploy

## Available Events

### Navigation Events

Automatically tracked on every page/route change.

| Event | Properties | Description |
|-------|-----------|-------------|
| `navigation:pageview` | `path`, `search` | User navigates to a page |
| `navigation:navigate` | `destination`, `source` | Custom navigation event |
| `navigation:external_link` | `url`, `source` | User clicks external link |

**Usage:**
```typescript
import { trackNavigation, trackExternalNavigation } from '@/utils/analyticsRouting'

// Track custom navigation
trackNavigation('/dashboard', 'sidebar')

// Track external link click
trackExternalNavigation('https://stellar.org', 'footer')
```

### Feature Events

Track user interactions with core features.

| Event | Properties | Description |
|-------|-----------|-------------|
| `feature:export` | `format`, `rows` | User exports data (CSV, JSON, XLSX, PDF) |
| `feature:alert_create` | `type` | User creates alert (threshold or percentage) |
| `feature:alert_triggered` | `source`, `direction` | Price alert triggers |
| `feature:alert_dismiss` | `snoozed` | User dismisses/snoozes alert |
| `feature:preference_change` | `preference`, `value` | User changes settings |
| `feature:filter_action` | `filter`, `action` | User applies/clears/resets filters |
| `feature:search` | `query`, `results` | User searches for price pair |
| `feature:chart_interaction` | `action` | User interacts with price chart (zoom, pan, etc.) |

**Usage:**
```typescript
import {
  trackExport,
  trackAlertCreate,
  trackAlertTriggered,
  trackPreferenceChange,
  trackFilterAction,
  trackSearch,
  trackChartInteraction,
} from '@/utils/analytics'

// Track CSV export with 1000 rows
trackExport('csv', 1000)

// Track alert creation
trackAlertCreate('threshold')

// Track alert trigger
trackAlertTriggered('chainlink', 'upper')

// Track preference change
trackPreferenceChange('theme', 'dark')

// Track filter application
trackFilterAction('confidence', 'apply')

// Track search
trackSearch('BTC/USD', 5)

// Track chart interaction
trackChartInteraction('zoom')
```

### Engagement Events

Track UI interactions and advanced features.

| Event | Properties | Description |
|-------|-----------|-------------|
| `engagement:panel_toggle` | `panel`, `action` | User opens/closes alerts or settings panel |
| `engagement:keyboard_shortcut` | `shortcut` | User uses keyboard shortcut |
| `engagement:api_docs_view` | `section` | User views API documentation |

**Usage:**
```typescript
import {
  trackPanelToggle,
  trackKeyboardShortcut,
  trackApiDocView,
} from '@/utils/analytics'

// Track panel toggle
trackPanelToggle('alerts', 'open')

// Track keyboard shortcut
trackKeyboardShortcut('cmd+e')

// Track API docs view
trackApiDocView('price-history')
```

### Performance Events

Automatically tracked. Can be manually triggered for custom metrics.

| Event | Properties | Description |
|-------|-----------|-------------|
| `performance:web_vital_*` | `value`, `rating`, `delta` | Core Web Vitals (LCP, FID, CLS, INP, FCP, TTFB) |
| `performance:page_load_timing` | `dom_load_ms`, `total_load_ms` | Page load timing |
| `performance:api_response` | `endpoint`, `method`, `time_ms`, `status` | API response time |
| `performance:websocket_*` | `duration_ms` | WebSocket events (connect, disconnect, reconnect, error) |
| `performance:memory_usage` | `used_mb`, `limit_mb`, `percentage` | Memory usage (if available) |
| `performance:rendering` | `fps`, `dropped_frames` | Frame rate and smoothness |

**Usage:**
```typescript
import {
  trackPerformanceMetric,
  trackWebVital,
  trackPageLoadTiming,
  trackApiResponseTime,
  trackWebSocketMetrics,
  trackMemoryUsage,
  trackRenderingPerformance,
} from '@/utils/performanceAnalytics'

// Track custom performance metric
trackPerformanceMetric('api_response_time', 245, 'ms', 'good')

// Track API response
trackApiResponseTime('/api/prices', 'GET', 245, 200)

// Track WebSocket connection
trackWebSocketMetrics('connect', 1500)

// Track rendering performance
trackRenderingPerformance(60, 0)
```

## Integration Points

### Automatic Tracking

These are tracked **automatically** without any code changes:

- ✅ Page views on route changes
- ✅ Core Web Vitals
- ✅ Resource timing (API requests)

### Manual Tracking

Add tracking to these components for feature usage insights:

#### ExportButton
```typescript
import { trackExport } from '@/utils/analytics'

// In the export handler
trackExport(format, dataRows.length)
```

#### AlertPanel / AlertModal
```typescript
import { trackAlertCreate, trackAlertTriggered, trackAlertDismiss } from '@/utils/analytics'

// When alert is created
trackAlertCreate(type)

// When alert fires
trackAlertTriggered(source, direction)

// When dismissed/snoozed
trackAlertDismiss(snoozeDuration)
```

#### PreferencesPanel
```typescript
import { trackPreferenceChange } from '@/utils/analytics'

// When preference changes
trackPreferenceChange(key, value)
```

#### FilterPanel / SearchBar
```typescript
import { trackFilterAction, trackSearch } from '@/utils/analytics'

// When filter is applied
trackFilterAction(filterType, 'apply')

// When search is performed
trackSearch(query, resultCount)
```

#### PriceChart
```typescript
import { trackChartInteraction } from '@/utils/analytics'

// On user interactions
trackChartInteraction('zoom')
trackChartInteraction('pan')
trackChartInteraction('tooltip')
```

## Accessing Analytics Data

### Plausible Dashboard

1. Log in to plausible.io
2. Select your site
3. View real-time analytics on the dashboard
4. Check "**Events**" tab for custom events

Example dashboard shows:
- Page views and traffic flow
- Custom events (exports, alerts, etc.)
- Performance metrics
- Device and browser distribution
- Geographic data

### Umami Dashboard

1. Log in to your Umami instance
2. Select your website
3. View events in real-time
4. Use filters to drill down into specific user behaviors

### Custom Endpoint

If you set `VITE_ANALYTICS_URL`, events are also sent as JSON POST requests:

```json
{
  "category": "feature",
  "name": "export",
  "props": {
    "format": "csv",
    "rows": 1000
  },
  "timestamp": 1693000000000
}
```

## Privacy Settings

### User Opt-Out

Users can disable analytics by opening the browser console and running:

```javascript
// Disable analytics
localStorage.setItem('analyticsOptOut', '1')

// Re-enable analytics
localStorage.removeItem('analyticsOptOut')
```

### Respecting Browser Privacy

Analytics automatically respects:
- **Do Not Track (DNT)** header
- **Global Privacy Control (GPC)** header

If either is enabled in the browser, analytics will not track.

## Data Retention

Data retention depends on your provider:

- **Plausible**: [Default retention policies](https://plausible.io/docs/data-retention)
- **Umami**: Configurable retention per your instance settings

## GDPR and Privacy Compliance

This analytics implementation is designed to be privacy-compliant:

✅ No PII collection  
✅ Respects user privacy preferences  
✅ No third-party cookies  
✅ Transparent opt-out mechanism  
✅ No personal data transmitted to third parties  

However, you should:
- **Disclose analytics** in your privacy policy
- **Obtain user consent** if required by local laws
- **Document data flow** with legal team

## Performance Impact

- ✅ Minimal: ~10KB gzipped for all analytics code
- ✅ Async: Events sent asynchronously without blocking UI
- ✅ Batched: Web Vitals sent using `sendBeacon` for reliability
- ✅ Non-intrusive: No tracking pixels or external requests on page load

## Troubleshooting

### Events not showing up

1. **Check configuration**
   ```bash
   echo $VITE_ANALYTICS_PROVIDER  # Should be 'plausible' or 'umami'
   echo $VITE_ANALYTICS_ID        # Should be set
   ```

2. **Check browser console**
   - Open DevTools → Console
   - Look for `[Analytics]` messages
   - In dev mode, you should see `[Analytics] Page view: /`

3. **Check opt-out status**
   ```javascript
   localStorage.getItem('analyticsOptOut')  // Should be null or undefined
   ```

4. **Check DNT/GPC**
   - In DevTools Settings, check if "Block tracking" is enabled
   - This will disable analytics

### Data not in provider dashboard

1. For Plausible:
   - Verify domain matches exactly
   - Check that build includes correct `VITE_ANALYTICS_ID`

2. For Umami:
   - Verify website ID is correct
   - Check that Umami instance is running

3. Check network requests in DevTools:
   - Should see POST requests to analytics endpoints
   - Check response status (200 = success)

## Example: Tracking a Feature

Here's a complete example of tracking the export feature:

```typescript
// In ExportButton component
import { trackExport } from '@/utils/analytics'

export function ExportButton() {
  const handleExport = async (format: 'csv' | 'json') => {
    // Track before exporting
    trackExport(format, data.length)
    
    // Perform export
    await performExport(format)
  }

  return <button onClick={() => handleExport('csv')}>Export CSV</button>
}
```

Result in Plausible dashboard:
- Event name: `feature:export`
- Property: `format: "csv"`
- Property: `rows: 1000`
- Real-time view shows users exporting data

## Further Reading

- [Plausible Analytics](https://plausible.io/docs)
- [Umami Documentation](https://umami.is/docs)
- [Web Vitals Guide](https://web.dev/vitals/)
- [GDPR Analytics Best Practices](https://gdpr.eu/)
