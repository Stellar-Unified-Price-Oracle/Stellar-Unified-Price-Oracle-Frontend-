# Component Documentation

Reference for every reusable component in `src/components/`. Each component is
documented with JSDoc inline; this file provides the hierarchy overview, a quick
props table, and cross-cutting notes.

---

## Component Hierarchy

```
App
└── Layout
    ├── <nav> (desktop top bar + mobile bottom tab bar)
    │   └── NavLink × N
    ├── AlertPanel          (slide-in, renders null when closed)
    │   └── AlertHistoryLog
    └── <main>
        ├── Dashboard (page)
        │   ├── PairSearchBar
        │   ├── FilterPanel
        │   ├── ExportButton
        │   ├── AlertBadge
        │   ├── DraggablePriceGrid     (card view)
        │   │   └── PriceCard × N
        │   │       ├── Tooltip (confidence)
        │   │       └── Tooltip (source badges)
        │   ├── PriceTableView         (table view)
        │   └── AlertModal
        ├── PriceDetail (page)
        │   ├── PriceChart
        │   │   └── CanvasChart
        │   ├── PriceHistoryTable
        │   └── DateRangePicker
        ├── ApiDocs (page)
        └── NotFound (page)

Providers (wrapping App)
├── PreferencesProvider   — IndexedDB-backed preferences + undo/redo
├── PriceProvider         — WebSocket + REST price data
├── AlertsProvider        — Alert state, threshold eval, notifications
├── ToastProvider         — Toast queue
├── KeyboardShortcutsProvider
└── ErrorReporterProvider
```

---

## Components Reference

### PriceCard

Displays a single aggregated price feed card.

| Prop           | Type                                              | Default     | Description                                         |
|----------------|---------------------------------------------------|-------------|-----------------------------------------------------|
| `price`        | `PriceData`                                       | —           | Price data to display                               |
| `onClick`      | `(assetPair: string) => void`                     | `undefined` | Called on card click / Enter / Space                |
| `isLive`       | `boolean`                                         | `false`     | Reserved for flash animation                        |
| `isStale`      | `boolean`                                         | `false`     | Renders at 60 % opacity when true                   |
| `syncState`    | `PriceSyncState`                                  | `undefined` | Optimistic sync state indicator                     |
| `flashVersion` | `number`                                          | `undefined` | Increment to trigger CSS price-update animation     |
| `isValidating` | `boolean`                                         | `false`     | Shows spinner during background REST revalidation   |
| `hasAlert`     | `boolean`                                         | `false`     | Shows alert button in amber (active) state          |
| `onAlertClick` | `(e: React.MouseEvent, assetPair: string) => void`| `undefined` | Called when alert button is clicked                 |
| `selectMode`   | `boolean`                                         | `false`     | Shows checkbox for multi-select                     |
| `isSelected`   | `boolean`                                         | `false`     | Highlights card with cyan ring when selected        |

**Memoization note**: pass `onClick` / `onAlertClick` as stable references; the
component uses `useCallback` internally but re-creating the prop identity every
render defeats `memo()`. See `AGENTS.md` § Memoization Convention.

---

### ConnectionBadge

WebSocket status pill with coloured dot.

| Prop              | Type                   | Default     | Description                                      |
|-------------------|------------------------|-------------|--------------------------------------------------|
| `status`          | `ConnectionStatus`     | —           | One of: connected, connecting, reconnecting, waiting, dead, disconnected |
| `rateLimitStatus` | `RateLimitStatus`      | `undefined` | When `'limited'`, overrides label + colour       |
| `retryAfterMs`    | `number`               | `undefined` | Countdown shown with rate-limit label            |
| `diagnostics`     | `ConnectionDiagnostics`| `undefined` | Adds retry count to label on reconnect states    |

---

### SourceHealthBadge

Row of oracle source pills derived from a list of source names.

| Prop      | Type               | Default | Description                            |
|-----------|--------------------|---------|----------------------------------------|
| `sources` | `readonly string[]`| —       | Oracle keys: `chainlink`, `redstone`, `band`, `reflector` |

Renders `"No sources"` muted text when the array is empty.

---

### Tooltip

Accessible hover / focus tooltip.

| Prop       | Type        | Default | Description                              |
|------------|-------------|---------|------------------------------------------|
| `content`  | `string`    | —       | Tooltip text                             |
| `children` | `ReactNode` | —       | Trigger element                          |

---

### ErrorBoundary

Class component that catches render-time errors.

| Prop           | Type                              | Default       | Description                                      |
|----------------|-----------------------------------|---------------|--------------------------------------------------|
| `children`     | `ReactNode`                       | —             | Subtree to protect                               |
| `fallback`     | `ReactNode`                       | built-in UI   | Custom fallback element                          |
| `onError`      | `(error, info) => void`           | `undefined`   | Error reporting callback                         |
| `boundaryId`   | `string`                          | `'unknown'`   | Identifier for error reports                     |
| `showGoBack`   | `boolean`                         | `false`       | Shows "Go back" button in fallback               |
| `featureLabel` | `string`                          | `'This section'` | Context label in fallback heading             |

---

### AlertBadge

Compact pill summarising active alert count and directionality.

| Prop      | Type         | Default     | Description                                |
|-----------|--------------|-------------|--------------------------------------------|
| `count`   | `number`     | —           | Active alert count; renders null when 0    |
| `alerts`  | `Alert[]`    | —           | Used to derive directional indicator       |
| `onClick` | `() => void` | `undefined` | Opens alert panel                          |

---

### AlertPanel

Slide-in panel listing configured alerts. No props — driven entirely by `useAlerts()`.

Renders `null` when `isPanelOpen` is `false`.

---

### AlertModal

Modal for creating and editing alerts.

| Prop               | Type                        | Default     | Description                                     |
|--------------------|-----------------------------|-------------|-------------------------------------------------|
| `isOpen`           | `boolean`                   | —           | Controls visibility                             |
| `onClose`          | `() => void`                | —           | Dismiss callback                                |
| `onSave`           | `(data: AlertFormData) => void` | —       | Save callback with validated data               |
| `onDelete`         | `() => void`                | `undefined` | Delete callback for existing alerts             |
| `onReEnable`       | `() => void`                | `undefined` | Re-enable callback for fired-once alerts        |
| `alert`            | `Alert \| null`             | `null`      | Pre-fills form when editing                     |
| `currentPrice`     | `number`                    | `undefined` | Shown as context next to threshold fields       |
| `defaultAssetPair` | `string`                    | `undefined` | Pre-fills asset pair for new alerts             |

---

### ExportButton

Dropdown trigger for CSV / JSON / XLSX export.

| Prop       | Type                           | Default | Description                                      |
|------------|--------------------------------|---------|--------------------------------------------------|
| `onExport` | `(format: ExportFormat) => void` | —     | Called with chosen format                        |
| `exporting`| `boolean`                      | —       | Shows spinner and disables while true            |
| `disabled` | `boolean`                      | `false` | Disables button (e.g. no data to export)         |

---

### PreferencesPanel

Embedded preferences form with undo/redo. No props — driven by `usePreferences()`.

Must be rendered inside `<PreferencesProvider>`.

---

### PriceTableView

Sortable table of all price pairs.

| Prop             | Type                                          | Default     | Description                              |
|------------------|-----------------------------------------------|-------------|------------------------------------------|
| `items`          | `PriceData[]`                                 | —           | Rows to display                          |
| `livePairs`      | `Set<string>`                                 | —           | Pairs with active WebSocket updates      |
| `isStale`        | `boolean`                                     | `false`     | All rows at 60 % opacity                 |
| `onRowClick`     | `(pair: string) => void`                      | —           | Row click / keyboard activation          |
| `onAlertClick`   | `(e: React.MouseEvent, pair: string) => void` | —           | Alert button click                       |
| `hasAlertFn`     | `(pair: string) => boolean`                   | —           | Returns true if pair has an alert        |
| `selectMode`     | `boolean`                                     | `false`     | Enables checkbox column                  |
| `selected`       | `Set<string>`                                 | `undefined` | Currently selected pairs                 |
| `onToggleSelect` | `(pair: string) => void`                      | `undefined` | Toggle selection for a pair              |

---

## Accessibility Notes (Cross-Cutting)

- All interactive custom elements (`PriceCard`, `PriceTableView` rows) use
  `role="button"` + `tabIndex={0}` + keyboard handlers for `Enter` / `Space`.
- Modals (`AlertModal`) use `useFocusTrap` to keep keyboard focus inside while open.
- Status indicators (connection dot, live pulse) carry `aria-hidden="true"` or
  `role="status"` with a text label; colour alone never conveys meaning.
- Tooltips link triggers to popups via `aria-describedby`.
- All icon-only SVGs carry `aria-hidden="true"`; nearby text or `aria-label` conveys
  the intent.
- `react-i18next` is used for all user-visible strings; no hardcoded English in JSX
  (except developer-facing error details inside `ErrorBoundary`).

## Loading / Empty / Error States

| Component       | Loading                     | Empty                        | Error                          |
|-----------------|-----------------------------|------------------------------|--------------------------------|
| Dashboard       | `DashboardSkeleton`         | "No results" filter message  | `ErrorBoundary` wraps page     |
| PriceDetail     | `PriceDetailSkeleton`       | —                            | `ErrorBoundary` wraps page     |
| PriceChart      | Recharts renders empty axes | Empty area chart             | `ErrorBoundary featureLabel`   |
| AlertPanel      | —                           | "Add your first alert" prompt| —                              |
| PriceTableView  | —                           | Empty `<tbody>`              | —                              |
| ConnectionBadge | `connecting` status         | —                            | `dead` / `disconnected` status |
