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
8. [Resources](#resources)

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
   - Don't announce the same message rapidly

3. **Keep announcements concise:**
   ```tsx
   ✅ Good:   "BTC price is now $70,000"
   ❌ Bad:    "The price of Bitcoin has changed to seventy thousand dollars"
   ```

4. **Announce important state changes:**
   - Connection status (connected, reconnecting, disconnected)
   - Data loading (prices loaded, filtered)
   - User actions (alert created, snoozed)

5. **Test with screen readers:**
   - Use NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS)
   - Verify announcements are clear and timely

### ❌ Don't

1. **Don't announce every tiny change:**
   ```tsx
   ❌ Bad: Announce price every tick
   ✅ Good: Announce only significant moves (1%+)
   ```

2. **Don't use assertive for everything:**
   ```tsx
   ❌ Bad: announce('Price updated', 'assertive')
   ✅ Good: announce('Price updated', 'polite')
   ```

3. **Don't announce purely visual feedback:**
   ```tsx
   ❌ Bad: announce('Icon animated')
   ✅ Good: announce('Data loaded')
   ```

4. **Don't make announcements too verbose:**
   ```tsx
   ❌ Bad: "Bitcoin United States Dollar price changed to seventy thousand"
   ✅ Good: "BTC/USD $70,000"
   ```

---

## Testing Accessibility

### Unit Tests

Test announcement behavior:

```tsx
import { renderHook } from '@testing-library/react'
import { useAnnounce } from '../hooks/useAnnounce'

describe('usePriceAnnouncer', () => {
  it('announces significant price changes', () => {
    const { result } = renderHook(() => useAnnounce())
    const listener = vi.fn()

    result.current.subscribe(listener)
    result.current.announce('BTC updated to $70,000', 'polite')

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'BTC updated to $70,000',
        priority: 'polite',
      }),
    )
  })

  it('deduplicates identical announcements', () => {
    const { result } = renderHook(() =>
      useAnnounce({ deduplicationMs: 1000 })
    )
    const listener = vi.fn()

    result.current.subscribe(listener)
    result.current.announce('Test')
    result.current.announce('Test')  // Deduplicated

    expect(listener).toHaveBeenCalledOnce()
  })
})
```

### Manual Testing with Screen Readers

1. **Enable VoiceOver (macOS):**
   ```
   Cmd + F5
   ```

2. **Enable NVDA (Windows):**
   ```
   Download from https://www.nvaccess.org/
   ```

3. **Test announcement flow:**
   - Open DevTools → Elements
   - Locate `[role="status"]` and `[role="alert"]` regions
   - Verify announcements appear there
   - Listen to screen reader output

4. **Verify with real data:**
   - Open app
   - Trigger price updates (watch live prices)
   - Listen for announcements
   - Check connection status changes

### Accessibility Audits

Use automated tools for baseline checks:

```bash
# ESLint accessibility plugin
npm run lint

# axe DevTools browser extension
# https://www.deque.com/axe/devtools/

# Lighthouse (built into Chrome DevTools)
# Audit > Accessibility
```

---

## Implementation Checklist

When adding new components that display dynamic content:

- [ ] Identify what content changes dynamically
- [ ] Choose appropriate priority (polite for normal, assertive for urgent)
- [ ] Create/use appropriate announcer hook
- [ ] Configure deduplication to prevent spam
- [ ] Test with screen reader
- [ ] Document announcement behavior

### Example: Adding Announcement to New Component

```tsx
import { usePriceAnnouncer } from '../hooks/usePriceAnnouncer'

function NewDashboard() {
  const prices = usePrices()

  // Step 1: Import announcer
  // Step 2: Configure it
  usePriceAnnouncer(prices, {
    minPercentageChange: 1,
    deduplicationMs: 5000,
  })

  // Step 3: Render normally
  return <PriceTable prices={prices} />
}
```

---

## Common Issues & Solutions

### Issue: Announcements are repeating too much

**Solution:** Increase deduplication window or min change threshold
```tsx
usePriceAnnouncer(prices, {
  minPercentageChange: 5,    // Increased from 1%
  deduplicationMs: 10000,    // Increased from 5000ms
})
```

### Issue: Screen reader isn't hearing announcements

**Solution:** 
1. Verify `LiveRegionContainer` is mounted in `Layout.tsx`
2. Check that `useAnnounce()` is being called
3. Use browser DevTools to verify region content is updating
4. Try different screen reader (NVDA, JAWS, VoiceOver)

### Issue: Announcements are getting cut off

**Solution:** Use shorter, punchier messages
```tsx
✅ const msg = `BTC $70,000`
❌ const msg = `The Bitcoin price has changed to seventy thousand dollars`
```

### Issue: Too many announcements at once

**Solution:** Use `maxAnnouncementsPerBatch` and `deduplicationMs`
```tsx
usePriceAnnouncer(prices, {
  maxAnnouncementsPerBatch: 1,  // Only announce most significant
  deduplicationMs: 15000,        // Wait 15s between announcements
})
```

---

## Resources

### ARIA & Screen Readers
- [MDN: ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [W3C: Live Region Best Practices](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA23)
- [WebAIM: Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)

### Tools
- [NVDA Screen Reader](https://www.nvaccess.org/) (free, Windows)
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) (commercial, Windows)
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) (built-in, macOS/iOS)
- [axe DevTools](https://www.deque.com/axe/devtools/) (browser extension)

### Testing
- [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) — component testing
- [Vitest](https://vitest.dev/) — unit test runner
- [Playwright](https://playwright.dev/) — E2E testing with accessibility checks

### Standards
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/) — Web Content Accessibility Guidelines
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) — implementation patterns
- [Section 508](https://www.section508.gov/) — US accessibility requirements

---

## Questions?

For accessibility issues or suggestions:
1. Check this documentation
2. Review the example code in announcement hooks
3. Test with a real screen reader
4. File an issue with details about the problem

Together we're making price oracles accessible to everyone! 🎯
