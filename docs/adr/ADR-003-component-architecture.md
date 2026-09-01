# ADR-003: Component Architecture and Composition

## Status

Accepted

## Context

The application renders a large list of price cards (potentially thousands) in a real-time dashboard. Performance is critical:

- Price updates arrive 10+ times per second
- Each update potentially re-renders the entire component tree (if not memoized)
- Mobile devices have limited CPU; unnecessary re-renders cause jank
- Users expect smooth animations and immediate visual feedback

Additionally, managing component complexity requires clear patterns for data flow, memoization, and composition.

## Decision

**Functional components with React.memo + composition-based architecture + strict memoization conventions.**

### Principle 1: Functional Components

All components are functional components (no class components):

```tsx
// ✓ Good
export const PriceCard = memo(function PriceCard({ price, onClick }) {
  return <div>{price.assetPair}</div>
})

// ✗ Avoid
export class PriceCard extends React.Component { ... }
```

**Benefits:**
- Hooks enable data fetching and side effects directly in components
- Easier to test and reason about
- Smaller bundle size
- `memo()` is straightforward

### Principle 2: Memoization Convention

**Memoize when it changes behavior, not by reflex.**

A component should be wrapped in `memo()` when it's used as a child in a list or passed as a prop to another memoized component. Otherwise, memoization is wasteful—React's render phase is fast; what matters is avoiding unnecessary renders in the first place.

#### Rule 1: Memoize list items

```tsx
// ✓ Good: PriceCard is memoized because it's rendered in a list
export const PriceCard = memo(function PriceCard(props) {
  return <div>...</div>
})

// Usage
{prices.map(price => (
  <PriceCard key={price.assetPair} price={price} onClick={handleClick} />
))}

// ✗ Wrong: Without memo(), PriceCard re-renders on every Dashboard render,
// causing animation jank when prices update.
```

#### Rule 2: Memoize passed callbacks in memoized components

```tsx
// ✓ Good: Callback is stable (wrapped in useCallback)
const Dashboard = () => {
  const handleCardClick = useCallback((pair: string) => {
    navigate(`/prices/${pair}`)
  }, [navigate])
  
  return <PriceCard onClick={handleCardClick} />
}

// ✗ Wrong: New closure on every render defeats PriceCard's memo()
const Dashboard = () => {
  return (
    <PriceCard onClick={(pair) => navigate(`/prices/${pair}`)} />
  )
}
```

#### Rule 3: Don't memoize host element handlers

```tsx
// ✓ Good: No need to wrap onChange handler
<button onClick={() => setOpen(!open)}>Open</button>

// ✗ Wasteful: React doesn't re-render because handler identity changed
<button onClick={useCallback(() => setOpen(!open), [])}> Open</button>
```

The handler is only called if the button re-renders; a new closure doesn't cause a re-render.

#### Rule 4: Structure data to minimize re-renders

Instead of passing a callback to every list item:

```tsx
// ✗ Bad: New closure per item, defeats memo()
{items.map(item => (
  <Item key={item.id} onClick={() => handleItemClick(item.id)} />
))}

// ✓ Good: Stable handler, item calls back with its ID
{items.map(item => (
  <Item key={item.id} onSelect={handleItemClick} itemId={item.id} />
))}

// Inside Item:
const handleClick = useCallback(() => {
  onSelect(itemId)  // Item knows its own ID
}, [itemId, onSelect])
```

### Principle 3: Composition Layers

Components are organized in layers by responsibility:

#### Layer 1: Pages (`src/pages/`)

Top-level route components. Manage page-level state (filters, view mode), fetch data, and orchestrate lower layers.

```tsx
// Dashboard.tsx
export function Dashboard() {
  const { prices, refetchPrices } = usePriceContext()
  const [viewMode, setViewMode] = useState('card')
  
  return (
    <DashboardLayout>
      <PriceCardGrid prices={prices} viewMode={viewMode} />
    </DashboardLayout>
  )
}
```

#### Layer 2: Containers (`src/pages/` or inline)

Components that coordinate multiple children. Fetch or transform data, manage shared state, pass down callbacks.

Usually not memoized (they control the entire subtree anyway).

```tsx
// Inside Dashboard.tsx
function PriceCardGrid({ prices, viewMode }) {
  return (
    {viewMode === 'card' ? (
      <DraggablePriceGrid prices={prices} />
    ) : (
      <PriceTableView prices={prices} />
    )}
  )
}
```

#### Layer 3: Presentational Components (`src/components/`)

Reusable, memoized components that receive data and callbacks as props. Don't fetch data; don't manage global state directly.

```tsx
// PriceCard.tsx - highly reusable, memoized
export const PriceCard = memo(function PriceCard({
  price,
  onClick,
  isStale,
}) {
  return (
    <div onClick={() => onClick?.(price.assetPair)}>
      <span>{price.assetPair}</span>
      <span>{price.price}</span>
    </div>
  )
})
```

#### Layer 4: Layout Components (`src/components/Layout.tsx`)

Shared structural components (header, footer, sidebars). Memoized to avoid re-rendering on page content changes.

```tsx
// Layout.tsx
export const Layout = memo(function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
})
```

### Principle 4: Data Flow

**Unidirectional: context/store → component → callback → handler.**

Never mutate props or pass handlers upward.

```tsx
// ✓ Good: Data flows down, callbacks flow up
function Dashboard() {
  const { prices } = usePriceContext()
  const handleCardClick = useCallback((pair) => {
    navigate(`/prices/${pair}`)
  }, [navigate])
  
  return <PriceCard price={prices[0]} onClick={handleCardClick} />
}

function PriceCard({ price, onClick }) {
  return <div onClick={() => onClick(price.assetPair)}>...</div>
}

// ✗ Bad: Circular dependency, mutating props
function PriceCard({ price }) {
  const navigate = useNavigate()
  price.onClick = () => navigate(...)  // Mutating prop!
}
```

### Principle 5: Isolation with Error Boundaries

Components are wrapped in `<ErrorBoundary>` at page and major subtree levels:

```tsx
// src/components/ErrorBoundary.tsx
export const ErrorBoundary = memo(function ErrorBoundary({
  children,
  fallback,
}) {
  // Catches errors in children; renders fallback UI
})

// Usage
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

### Principle 6: Suspense for Async Operations

Route components use `<Suspense>` for code splitting and data fetching:

```tsx
// App.tsx
<Suspense fallback={<PageSkeleton />}>
  <Dashboard />
</Suspense>
```

This enables:
- Route-level code splitting (lazy-loaded on navigation)
- Streaming SSR (if applicable)
- Skeleton screens during loading

### Principle 7: List Virtualization

Long lists (100+ items) use `@tanstack/react-virtual` to render only visible items:

```tsx
// PriceTableView.tsx
const { getVirtualItems, getTotalSize } = useVirtualizer({
  count: prices.length,
  getScrollElement: () => tableRef.current,
  estimateSize: () => 40,  // 40px per row
})

// Renders only ~20 rows even if there are 10k
return (
  <div style={{ height: getTotalSize() }}>
    {getVirtualItems().map(item => (
      <PriceRow key={prices[item.index].assetPair} price={prices[item.index]} />
    ))}
  </div>
)
```

## Component Structure Template

New components should follow this structure:

```tsx
/**
 * @file ComponentName
 * 
 * Brief description of what this component does.
 * 
 * @example Basic usage
 * ```tsx
 * <ComponentName prop1="value" onEvent={handleEvent} />
 * ```
 * 
 * @example Advanced usage
 * ```tsx
 * <ComponentName {...props} customOption={true} />
 * ```
 * 
 * ## Edge cases
 * - **Empty state**: What happens when data is empty?
 * - **Loading**: Skeleton or spinner?
 * - **Error**: Fallback UI?
 * 
 * ## Accessibility
 * - Keyboard navigation: How does tabbing work?
 * - Screen reader labels: What do blind users hear?
 * - Contrast: Colors pass WCAG AA?
 * 
 * ## Performance
 * - Why is this component memoized (or not)?
 * - Does it virtualize large lists?
 * - Any known performance gotchas?
 */
import { memo, useCallback } from 'react'
import type { ComponentProps } from './types'

/** Props for {@link ComponentName}. */
interface ComponentNameProps {
  /** Description of prop. */
  prop1: string
  /** Description of event handler. */
  onEvent?: (value: string) => void
}

/**
 * Displays/manages/handles [specific responsibility].
 * 
 * Must be used inside [context name] if applicable.
 * Memoized to prevent re-renders when parent updates.
 */
export const ComponentName = memo(function ComponentName({
  prop1,
  onEvent,
}: ComponentNameProps) {
  const handleClick = useCallback(() => {
    onEvent?.(prop1)
  }, [prop1, onEvent])

  return (
    <div onClick={handleClick} role="button">
      {prop1}
    </div>
  )
})
```

## Performance Optimization Checklist

- [ ] Component is memoized if it's a list item or passed to memoized parent
- [ ] Callbacks passed to memoized children are wrapped in `useCallback`
- [ ] Dependencies in `useCallback` / `useEffect` are explicitly listed
- [ ] Expensive computations are wrapped in `useMemo` (if profiler confirms cost)
- [ ] List items use stable `key` (not index; preferably ID)
- [ ] Large lists (100+) use virtualization (`@tanstack/react-virtual`)
- [ ] Heavy data parsing happens in Web Worker, not main thread
- [ ] Accessibility tested with keyboard navigation and screen reader
- [ ] Component renders correctly on mobile (portrait/landscape)
- [ ] Bundle size checked (`npm run size-limit`)

## Related Decisions

- **ADR-001**: State management (where component data comes from)
- **ADR-002**: Data fetching (how to get data into components)

## Further Reading

- [React.memo()](https://react.dev/reference/react/memo)
- [useCallback()](https://react.dev/reference/react/useCallback)
- [Profiling React apps](https://react.dev/learn/render-and-commit)
- [Handling Infinite Lists](https://react-window.vercel.app/)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## Questions for Contributors

1. **Should I memoize this component?**
   - Memoize if it's a list item
   - Memoize if callbacks passed to it should be stable
   - Don't memoize if parent always passes different props
   - Profile (`npm run test`) before adding memo() to be sure

2. **What if my memoized component has expensive computations?**
   - Move computation to parent if possible (lazy rendering)
   - Use `useMemo()` to cache computed values
   - Move to Web Worker if computation is 50ms+ (chart aggregation, export)

3. **How do I debug re-renders?**
   - Enable React DevTools Profiler: React DevTools → Profiler tab
   - Record interactions, inspect which components re-rendered
   - Use `useRenderTracker` hook to log render info in console
   - Add `console.log` in render phase to find unexpected re-renders

4. **When should I extract a component?**
   - Extract when it exceeds 200 lines
   - Extract when it has multiple responsibilities
   - Extract when it's reused in 2+ places
   - Extract when it makes parent component easier to understand

5. **How do I handle loading/error/empty states?**
   - Use `<Suspense>` for loading (route-level)
   - Use `<ErrorBoundary>` for errors (component-level)
   - Render empty state in component (no children message)
   - Use skeleton screens for perceived performance

6. **How does list virtualization work?**
   - Only renders visible items (~20) instead of all 10k
   - Renders a spacer div above/below to reserve space
   - Recalculates on scroll
   - Reduces memory and improves scroll smoothness
