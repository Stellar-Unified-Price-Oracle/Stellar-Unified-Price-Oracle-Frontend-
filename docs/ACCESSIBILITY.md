# Accessibility Guidelines

This document outlines the accessibility features and guidelines for the Stellar Unified Price Oracle Frontend, with a focus on supporting users with visual impairments via screen reader announcements and ARIA live regions.

## Table of Contents

1. [Overview](#overview)
2. [ARIA Live Regions](#aria-live-regions)
3. [Announcement System](#announcement-system)
4. [Using Announcer Hooks](#using-announcer-hooks)
5. [Configuration & Frequency Control](#configuration--frequency-control)
6. [Best Practices](#best-practices)
7. [Testing Accessibility](#testing-accessibility)
8. [Post-Release Health Checklist](#post-release-health-checklist)
9. [Resources](#resources)

---

## Overview

The application uses **ARIA live regions** and a centralized **announcement registry** to communicate dynamic content changes to screen readers. This ensures visually impaired users don't miss critical information like:

- Real-time price updates
- Price alert firings
- WebSocket connection status changes
- Toast notifications
- Chart data changes

### Key Components

| Component | Purpose | Live Region |
|-----------|---------|------------|
| `LiveRegionContainer` | Renders hidden ARIA live regions for announcements | Both polite & assertive |
| `useAnnounce()` | Core hook for announcing messages | Registry-based |
| `usePriceAnnouncer()` | Announces significant price changes | Polite |
| `useAlertAnnouncer()` | Announces alert firings | Assertive |
| `useChartAnnouncer()` | Announces chart data updates | Polite |
| `useA11yConfig()` | Centralized accessibility configuration | N/A |

---

## ARIA Live Regions

### What Are ARIA Live Regions?

ARIA live regions are dynamic areas of the page that screen readers monitor for changes. When content in a live region updates, the screen reader announces the new content to the user.

### Polite vs Assertive

- **`aria-live="polite"`** — waits for a pause in speech before announcing. Use for non-urgent updates (prices, charts).
- **`aria-live="assertive"`** — interrupts current speech immediately. Use for urgent updates (alerts, errors, rate limits).

### LiveRegionContainer

Place this component once at the app shell level (e.g., in `Layout.tsx`):

```tsx
import { LiveRegionContainer } from '../components/LiveRegionContainer'

function Layout() {
  return (
    <div>
      <LiveRegionContainer /> {/* Renders hidden ARIA regions */}
      {/* Rest of layout */}
    </div>
  )
}
```

This component creates two hidden regions:
- `aria-live="polite"` — status announcements (prices, charts, data updates)
- `aria-live="assertive"` — alert announcements (alerts, errors, warnings)

---

## Announcement System

### Core Flow

```
Component wants to announce
       ↓
Call useAnnounce() hook
       ↓
announce(message, priority)
       ↓
AnnouncementRegistry
├─ Check deduplication
├─ Store in history
└─ Notify all subscribers
       ↓
LiveRegionContainer subscribers
├─ Update polite region
└─ Update assertive region
       ↓
Screen reader announces
```

### Deduplication

To prevent announcement spam, the system deduplicates identical messages within a configurable time window:

```tsx
// Won't announce "BTC updated" twice within 5 seconds
const { announce } = useAnnounce({ deduplicationMs: 5000 })

announce('BTC updated to $70,000')
announce('BTC updated to $70,000')  // Deduplicated
```

---

## Using Announcer Hooks

### usePriceAnnouncer

Announces significant price changes:

```tsx
import { usePriceAnnouncer } from '../hooks/usePriceAnnouncer'
import { usePriceContext } from '../context/PriceContext'

function Dashboard() {
  const prices = usePriceContext().prices

  // Announce prices that change 1%+ with 5s dedup
  usePriceAnnouncer(prices, {
    minPercentageChange: 1,
    deduplicationMs: 5000,
    maxAnnouncementsPerBatch: 3,
  })

  return <PriceTable prices={prices} />
}
```

**Configuration:**
- `minPercentageChange` — only announce if price changed by at least this %
- `deduplicationMs` — wait this long before announcing same price again
- `maxAnnouncementsPerBatch` — limit announcements per render (prevents spam)

**Related Hooks:**
- `usePriceDataAnnouncer()` — announce new/filtered data load
- `usePriceAlertAnnouncer()` — announce individual pair updates

### useAlertAnnouncer

Announces alert firings immediately:

```tsx
import { useAlertAnnouncer } from '../hooks/useAlertAnnouncer'
import { useAlerts } from '../hooks/useAlerts'

function AlertPanel() {
  const { alerts } = useAlerts()

  // Announce triggered alerts with assertive priority
  useAlertAnnouncer(alerts, {
    deduplicationMs: 3000,
    announceSnooze: false,
  })

  return <AlertList alerts={alerts} />
}
```

**Related Hooks:**
- `useIndividualAlertAnnouncer()` — announce single alert status
- `useAlertSummaryAnnouncer()` — announce alert statistics

### useChartAnnouncer

Announces chart data and range updates:

```tsx
import { useChartAnnouncer } from '../hooks/useChartAnnouncer'

function PriceChart() {
  const range = {
    high: 75000,
    low: 70000,
    current: 72500,
  }

  // Announce if range changed 1%+
  useChartAnnouncer(range, {
    minRangeChangePercent: 1,
    deduplicationMs: 5000,
  })

  return <Chart range={range} />
}
```

**Related Hooks:**
- `useChartDataTableAnnouncer()` — announce table data updates
- `useChartStatisticsAnnouncer()` — announce summary statistics

### useAnnounce (Core)

Direct hook for custom announcements:

```tsx
import { useAnnounce } from '../hooks/useAnnounce'

function CustomComponent() {
  const { announce, subscribe, getHistory } = useAnnounce()

  // Announce a message
  announce('Price updated', 'polite')

  // Announce urgent message
  announce('Connection lost!', 'assertive')

  // Subscribe to announcements
  useEffect(() => {
    const unsubscribe = subscribe((announcement) => {
      console.log('Announced:', announcement.message)
    })
    return unsubscribe
  }, [])

  // Get history
  const history = getHistory()
  return <div>{history.length} announcements made</div>
}
```

---

## Configuration & Frequency Control

### Accessibility Presets

Control announcement frequency globally with presets:

```tsx
import {
  useA11yConfig,
  DEFAULT_A11Y_CONFIG,
  A11Y_LOW_FREQUENCY,
  A11Y_HIGH_FREQUENCY,
} from '../hooks/useA11yConfig'

function AccessibilitySettings() {
  const { config, setPreset } = useA11yConfig()

  return (
    <div>
      <label>
        <input
          type="radio"
          onChange={() => setPreset('default')}
        />
        Default Announcements
      </label>
      <label>
        <input
          type="radio"
          onChange={() => setPreset('low-frequency')}
        />
        Low Frequency (fewer announcements, good for busy markets)
      </label>
      <label>
        <input
          type="radio"
          onChange={() => setPreset('high-frequency')}
        />
        High Frequency (all announcements, verbose)
      </label>
    </div>
  )
}
```

### Preset Comparison

| Preset | Min Price Change | Dedup Window | Max/Batch | Use Case |
|--------|------------------|--------------|-----------|----------|
| **Default** | 1% | 5s | 3 | Balanced, standard use |
| **Low Frequency** | 5% | 15s | 1 | Noisy markets, reduce spam |
| **High Frequency** | 0.1% | 1s | 10 | Detailed monitoring |

### Custom Configuration

```tsx
import { setA11yConfig, DEFAULT_A11Y_CONFIG } from '../hooks/useA11yConfig'

// Customize specific settings
setA11yConfig({
  ...DEFAULT_A11Y_CONFIG,
  price: {
    ...DEFAULT_A11Y_CONFIG.price,
    minPercentageChange: 2,  // 2% minimum
  },
  alert: {
    ...DEFAULT_A11Y_CONFIG.alert,
    deduplicationMs: 10000,  // 10 second dedup
  },
})
```

---

## Best Practices

### ✅ Do

1. **Use appropriate priority levels:**
   ```tsx
   // Urgent (alert firing, rate limit)
   announce('Alert: BTC dropped 10%', 'assertive')

   // Normal (price update, status change)
   announce('BTC updated to $70,000', 'polite')
   ```

2. **Avoid duplicate announcements:**
   - Use deduplication windows
   - Debounce rapid updates
   - Batch related announcements

3. **Provide context:**
   ```tsx
   // ❌ Bad: no context
   announce('Updated')

   // ✅ Good: clear context
   announce('BTC price updated to $70,000, up 2.5%')
   ```

4. **Respect user preferences:**
   - Honor `prefers-reduced-motion`
   - Provide frequency presets
   - Allow disabling announcements

### ❌ Don't

1. **Don't announce every update** — use thresholds and deduplication
2. **Don't use assertive for non-urgent** — reserve for alerts/errors
3. **Don't announce on initial load** — only on changes
4. **Don't nest live regions** — one polite, one assertive

---

## Testing Accessibility

### Manual Testing

1. **Screen reader testing:**
   - macOS: VoiceOver (Cmd+F5)
   - Windows: NVDA (free) or JAWS
   - Linux: Orca

2. **Keyboard navigation:**
   - Tab through all interactive elements
   - Verify focus indicators are visible
   - Test with `prefers-reduced-motion` enabled

3. **Automated testing:**
   ```bash
   npm run test:a11y
   ```

### Component Tests

```tsx
import { render, screen } from '@testing-library/react'
import { LiveRegionContainer } from '../components/LiveRegionContainer'

test('announces price updates politely', () => {
  render(<LiveRegionContainer />)
  const politeRegion = screen.getByRole('status')
  expect(politeRegion).toHaveAttribute('aria-live', 'polite')
})
```

---

## Post-Release Health Checklist

Use this checklist after every release to verify the frontend is healthy and that accessibility signals remain measurable. Each signal lists a **target**, **how to measure**, and the **expected behavior when data is unavailable or stale**.

### Measurable Frontend Signals

| Signal | Target | How to Measure | Stale / Unavailable Behavior |
|--------|--------|----------------|------------------------------|
| Live region presence | 2 regions (polite + assertive) | Inspect DOM for `[aria-live]`; assert in component test | If missing, treat as release blocker |
| Announcement dedup | 0 duplicate announcements within window | `getHistory()` length vs. unique messages | Registry returns empty history → show "no announcements" state |
| Price freshness | Last update < 60s | Compare `updatedAt` to `Date.now()` | Show explicit "stale data" badge; do not announce stale prices |
| WebSocket status | `connected` | Connection status indicator | Show "disconnected" state; announce assertively |
| Error rate | < 1% of requests | Frontend error boundary + API error logs | Surface error state with retry; never fabricate prices |
| Keyboard reachability | 100% of interactive elements | Tab-order audit | N/A — always required |
| Reduced motion | Respected | Toggle OS setting; verify animations disabled | N/A — always required |

### Checklist

- [ ] `LiveRegionContainer` renders both polite and assertive regions.
- [ ] Price announcements respect the configured `minPercentageChange` and dedup window.
- [ ] Stale prices (> 60s) display an explicit stale badge and are not announced as fresh.
- [ ] Unavailable data shows an empty/error state with a retry affordance — no fabricated values.
- [ ] WebSocket disconnects are announced assertively and reflected in the status indicator.
- [ ] All interactive controls are reachable and operable via keyboard with visible focus.
- [ ] `prefers-reduced-motion` disables non-essential animation.
- [ ] Automated a11y tests pass (`npm run test:a11y`).

### Dependencies

If a signal cannot be measured with the current API contract (e.g., no `updatedAt` field on price payloads), document the required API/contract change here as a dependency rather than fabricating data. Track these as follow-up issues before the signal can be enforced.

---

## Resources

- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN: ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [WebAIM: Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [Deque: Accessibility Testing](https://www.deque.com/axe/)
