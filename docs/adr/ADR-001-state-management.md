# ADR-001: State Management Approach

## Status

Accepted

## Context

The application manages multiple types of state that have different characteristics:

- **REST-fetched data** (prices from API, relatively static, polled periodically)
- **WebSocket-driven live updates** (high-frequency price updates, optimistic, confirmed via REST)
- **User preferences** (rarely change, must persist across sessions)
- **UI state** (alerts, filters, modal visibility, local to components)
- **Client infrastructure** (rate limiting, rate limiting, rate limit status)

Different state types have different update frequencies, persistence requirements, and subscription patterns. Using a single monolithic store creates unnecessary re-renders across the entire component tree when any piece of state changes.

## Decision

**Hybrid approach:** React Context for low-frequency data (REST prices, preferences) + Zustand stores for high-frequency updates (WebSocket live prices) + Local component state for ephemeral UI state.

### Layer 1: React Context (Low-Frequency)

**PriceContext** (`src/context/PriceContext.tsx`)
- Manages REST API data fetching via TanStack Query
- Exposes current prices, loading states, validation states
- Manages WebSocket lifecycle (connect, subscribe, disconnect)
- Not suitable for high-frequency updates; re-renders all descendants when prices change

```tsx
const { prices, pricesLoading, pricesError, pricesValidating } = usePriceContext()
```

**PreferencesContext** (`src/preferences/PreferencesContext.tsx`)
- Persisted user settings (view mode, columns, freshness threshold, etc.)
- Updates triggered by user interactions (infrequent)
- Persisted to IndexedDB, loaded on mount
- Supports undo/redo via `useUndoRedo` hook

```tsx
const { preferences, updatePreference, undo, redo } = usePreferences()
```

### Layer 2: Zustand Stores (High-Frequency)

**priceStore** (`src/stores/priceStore.ts`)
- Live prices from WebSocket (high-frequency updates)
- WebSocket connection status
- Rate limiting status
- Consumers only re-render on the specific slice they subscribe to

```tsx
const livePrices = usePriceStore(s => s.livePrices)
const wsStatus = usePriceStore(s => s.wsStatus)
// Only re-renders when wsStatus changes, not on price updates
```

**preferencesStore** (`src/stores/preferencesStore.ts`)
- Computed aggregations of preferences for performance
- Filter state snapshots for views

**toastStore** (`src/stores/toastStore.ts`)
- Toast notifications (ephemeral)
- Shown/dismissed frequently

**rateLimitStore** (`src/stores/rateLimitStore.ts`)
- Rate limit status and metrics

### Layer 3: Local Component State

UI state that doesn't need to be shared (modals, selections, local forms) stays in component `useState`:

```tsx
const [modalOpen, setModalOpen] = useState(false)
const [selected, setSelected] = useState<Set<string>>(new Set())
```

### Layer 4: Web Workers (Compute-Heavy)

Long-running operations that would block the main thread run in Web Workers:

- `dataParser.worker.ts` — normalizing historical price data
- `chartAggregation.worker.ts` — resampling/aggregating chart data
- `export.worker.ts` — CSV/XLSX/PDF generation

Results are returned via `useWorkerChart`, `useWorkerExport`, `useWorkerDataParser` hooks.

## Data Flow

```
Browser
  │
  ├─ REST API ─────────────────► PriceContext
  │                               ├─ prices (TanStack Query)
  │                               ├─ pricesLoading
  │                               ├─ pricesValidating
  │                               └─ refetchPrices()
  │
  ├─ WebSocket ─────────────────► priceStore (Zustand)
  │                               ├─ livePrices
  │                               ├─ wsStatus
  │                               └─ rateLimitStatus
  │
  ├─ User Preferences ──────────► PreferencesContext
  │                               ├─ preferences
  │                               ├─ updatePreference()
  │                               └─ undo/redo
  │
  └─ UI State ──────────────────► Component State (useState)
                                   ├─ modals
                                   ├─ selections
                                   └─ forms
```

## Synchronization Between Layers

**PriceContext → priceStore**

PriceContext initially fetches all prices via REST. When a WebSocket message arrives, it updates `priceStore` optimistically. The `PriceContext` then revalidates against REST to confirm or rollback:

```tsx
// PriceContext.tsx
const unsubMsg = client.onMessage((msg) => {
  if (msg.type === 'price_update') {
    // 1. Update priceStore optimistically
    setLivePrices(prev => new Map(prev).set(msg.assetPair, {
      data: msg,
      syncState: 'optimistic'
    }))
    
    // 2. Revalidate against REST
    const restPrice = await fetchPricesBatched(msg.assetPair)
    
    // 3. Confirm or rollback
    if (restPrice matches msg) {
      syncState: 'confirmed'
    } else {
      syncState: 'rollback'
    }
  }
})
```

**PreferencesContext → localStorage**

Preferences are persisted to IndexedDB via `useIndexedDB` hook whenever they change:

```tsx
useEffect(() => {
  idbCache.set('preferences', PREFS_IDB_KEY, preferences)
}, [preferences])
```

## Benefits

1. **Minimal re-renders** — Components subscribing to fast-changing state (live prices) only re-render when that specific state changes, not on every update.

2. **Predictable scaling** — Adding a new high-frequency source (e.g., alternative WebSocket provider) adds another Zustand store, not a new context layer.

3. **Clear separation of concerns** — REST fetching (PriceContext), live updates (priceStore), persistence (PreferencesContext), computation (Web Workers).

4. **Undo/redo support** — Preferences support arbitrary undo/redo via a lightweight command-based reducer, without affecting other state layers.

5. **Easy to test** — Each layer (context, store, hook) can be tested independently. Zustand stores are plain objects without render-phase logic.

## Trade-Offs

1. **Multiple mental models** — Developers must understand context for low-frequency data vs. Zustand for high-frequency updates. Mitigated by clear conventions documented in `AGENTS.md`.

2. **Synchronization complexity** — Keeping context and stores in sync adds complexity. Mitigated by unidirectional data flow (context → store updates).

3. **No global time-travel debugging** — React DevTools doesn't integrate with Zustand stores. Zustand DevTools browser extension fills this gap.

## Rationale

React Context is designed for infrequent updates (theming, auth, feature flags). When context value changes, all descendants re-render regardless of whether they use that value. This creates unnecessary re-renders for high-frequency updates like WebSocket price feeds.

Zustand stores use a subscription model instead: components only re-render when the **specific slice** they select changes. This is essential for a real-time dashboard where prices update 10+ times per second.

The hybrid approach gets the best of both worlds:
- Context for clarity and simplicity (REST data, preferences)
- Zustand for performance (live prices, connection status)

## Related Decisions

- **ADR-002**: Data fetching strategy (REST polling + WebSocket live updates)
- **ADR-003**: Component architecture and composition (memoization conventions)

## Further Reading

- [Zustand documentation](https://github.com/pmndrs/zustand)
- [React Context best practices](https://react.dev/learn/passing-data-deeply-with-context)
- React: [Choosing the state structure](https://react.dev/learn/choosing-the-state-structure)
- Redux: [Normalizing state shape](https://redux.js.org/usage/structuring-reducers/normalizing-state-shape)

## Questions for Contributors

1. **When should state go in a new Zustand store vs. Context vs. component state?**
   - Use **component state** for ephemeral UI (modals, selections, forms)
   - Use **Context** for shared, low-frequency data (REST prices, preferences)
   - Use **Zustand store** for shared, high-frequency data (WebSocket updates)
   - Use **Web Workers** for compute-heavy tasks (export, charting)

2. **How do I subscribe to part of a Zustand store?**
   - Use a selector: `const livePrices = usePriceStore(s => s.livePrices)`
   - Only this component re-renders when `livePrices` changes

3. **How do I avoid infinite loops when using context?**
   - Wrap callbacks in `useCallback` when passing them to memoized components
   - Use dependency arrays carefully (see `AGENTS.md` memoization convention)
   - Use Zustand selectors to reduce subscription surface
