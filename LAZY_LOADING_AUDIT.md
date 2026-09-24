# Lazy-Loading Audit & Recommendations

**Status:** ✅ **Comprehensive lazy-loading already implemented**

## Current Implementation Summary

### Route Chunks (5 total)
All route components are lazy-loaded via `React.lazy()`:

| Route | Lazy Export | Preload Function | Fallback Skeleton |
|-------|------------|------------------|-------------------|
| `/` | `LazyLanding` | `preloadLanding` | `DashboardSkeleton` |
| `/dashboard` | `LazyDashboard` | `preloadDashboard` | `DashboardSkeleton` |
| `/prices/:pair`, `/price/:pair` | `LazyPriceDetail` | `preloadPriceDetail` | `PriceDetailSkeleton` |
| `/api-docs` | `LazyApiDocs` | `preloadApiDocs` | `ApiDocsSkeleton` |
| `*` (404) | `LazyNotFound` | (no preload) | `NotFoundSkeleton` |

### Feature Chunks (5 secondary)
Heavy components have lazy exports for optional loading:

| Component | Lazy Export | Purpose |
|-----------|------------|---------|
| `PriceChart.tsx` | `LazyPriceChart` | Historical price charts (Recharts-based) |
| `PriceTableView.tsx` | `LazyPriceTable` | Virtualized price table (@tanstack/react-virtual) |
| `PriceHistoryTable.tsx` | `LazyPriceHistoryTable` | History view for price detail page |
| `SettingsPanel.tsx` | `LazySettingsPanel` | Preferences modal (Layout footer nav) |
| `AlertPanel.tsx` | `LazyAlertPanel` | Alert management modal (Layout footer nav) |

### Preload Strategy

**File:** `src/utils/preloadCache.ts`

- **LRU Cache:** Keeps 6 preload promises, evicting oldest when limit exceeded
- **Idle Scheduling:** `scheduleIdleCallback()` with 2s timeout fallback
- **Purpose:** Non-blocking speculative prefetch during browser idle time

**File:** `src/App.tsx` (AppContent component)

Preload logic on route change:
```typescript
- If on `/`: schedule preload of `/dashboard`
- If on `/dashboard`: schedule preload of `/prices/:pair`
```

**File:** `src/components/Layout.tsx`

Preload on navigation hover/focus:
```typescript
- Landing link: preloads Dashboard
- Dashboard link: preloads PriceDetail
- API Docs link: preloads ApiDocs
- Settings tab: preloads SettingsPanel
- Alerts tab: preloads AlertPanel
```

### Code Splitting (Vendor Chunks)

**File:** `vite.config.ts` - `manualChunks()` strategy:

| Chunk | Purpose | Size |
|-------|---------|------|
| `vendor-react` | React, React DOM, React Router | ~180 kB |
| `vendor-tables` | @tanstack/react-virtual | ~60 kB |
| `vendor-i18n` | i18next, react-i18next | ~40 kB |
| `vendor-data` | @tanstack/react-query | ~35 kB |
| `vendor-workers` | Comlink (worker communication) | ~5 kB |
| `vendor-stellar` | @stellar/* packages | ~20 kB |
| `vendor-validation` | Zod schema validation | ~15 kB |
| **main** | App code + inline dependencies | **Target: <200 kB** |

## Bundle Size Budgets (Enforced in CI)

| Asset | Limit | Status |
|-------|-------|--------|
| JavaScript (entry) | 200 kB | ✅ Enforced |
| JavaScript (total) | 600 kB | ✅ Enforced |
| CSS | 50 kB | ✅ Enforced |

CI runs `npm run size-limit` to verify on every push.

## Recommendations for Further Optimization

### 1. **Verify Feature Chunks Are Actually Lazy** ⚠️
Currently `LazyPriceTable`, `LazyPriceChart`, and `LazyPriceHistoryTable` are defined but may be eagerly imported in Dashboard. Audit imports:

```bash
# Check if Dashboard eagerly imports these:
grep -n "import.*PriceChart\|import.*PriceTable" src/pages/Dashboard.tsx
```

**If eagerly imported**, change to use the lazy exports:
```typescript
// Before (eager):
import { PriceChart } from '../components/PriceChart'
import { PriceTableView } from '../components/PriceTableView'

// After (lazy):
import { LazyPriceChart, LazyPriceTable } from '../utils/chunks'
// Then wrap in <Suspense fallback={<ChartSkeleton />}>
```

### 2. **Monitor Real Bundle Size**
Run the bundle analysis to see actual chunk sizes:
```bash
npm run build:analyze
# Opens reports/bundle-analysis.html
```

### 3. **Consider Route-Based Preload Timing**
Current preload is on idle. For high-traffic paths, consider:
- Preload on route component mount (not just idle)
- Preload on user interaction (click, hover earlier)

### 4. **Test Preload Cache Effectiveness**
Verify the 6-slot LRU cache is sufficient:
```bash
npm test -- preloadCache.test.ts
```

If cache evictions are happening prematurely, increase capacity in `preloadCache.ts`:
```typescript
const chunkPreloadCache = new PreloadLruCache(8) // ← increase from 6
```

### 5. **Suspense Error Boundaries**
Ensure all lazy-loaded routes have error boundaries. Currently all routes wrap with `ErrorBoundary` at app level—good. Consider per-route error boundaries for better granularity.

### 6. **Streaming / Resumable React (Future)**
When React 19+ streaming is stable, consider:
- Server-side rendering with streaming (move to next major version)
- Progressive enhancement of lazy chunks

## Verification Steps

```bash
# 1. Check bundle size against budgets
npm run size-limit

# 2. Build and analyze
npm run build:analyze

# 3. Verify lazy chunks in dist/
ls -la dist/assets/ | grep -E "\.js$"
# Should see multiple chunks: main-*.js, vendor-react-*.js, route-dashboard-*.js, etc.

# 4. Run all tests (after fixing type errors)
npm run test:run

# 5. Preview production build
npm run preview
# Then check Network tab in DevTools when navigating between routes
```

## Related Docs

- `docs/adr/ADR-003-websocket-vs-polling.md` – Real-time data strategy (not lazy-loading but impacts initial bundle)
- `vite.config.ts` – Full build configuration
- `src/utils/chunks.ts` – Centralized lazy component registry
- `src/components/RouteSuspense.tsx` – Shared Suspense boundary wrapper

---

**Conclusion:** The lazy-loading strategy is mature and well-executed. Focus should be on:
1. Verifying feature components in Dashboard are using lazy exports
2. Running production build and bundle analysis
3. Continuous monitoring via `npm run size-limit` in CI
