# Hot Module Replacement (HMR) Optimization Guide

## Overview

Hot Module Replacement (HMR) lets you update code without losing application state—the magic behind "save file, see changes instantly". This guide explains how to get the best HMR experience and troubleshoot when it fails.

## How HMR Works

```
You save a file
    ↓
Vite detects change
    ↓
Vite compiles the module
    ↓
Vite sends update via WebSocket
    ↓
React Fast Refresh intercepts
    ↓
Component remounts with same state (ideally)
    ↓
You see changes in 50-200ms
```

When this works, it's invisible and magical. When it fails, the entire page reloads (losing your place, scrolling position, modal state, etc.).

## The Fast Path: React Fast Refresh

React Fast Refresh (built into Vite + @vitejs/plugin-react) usually Just Works™ for:

- Function component edits
- Hook calls
- JSX changes
- CSS changes

**But it fails for:**
- Exporting a new component from a file
- Changing a component's function signature
- Changes to class components
- Circular dependencies

When React Fast Refresh can't update in-place, Vite falls back to a full-page reload.

## Configuration: vite.config.ts

The HMR settings in `vite.config.ts` optimize for reliability:

```typescript
server: {
  hmr: {
    protocol: 'ws',           // WebSocket for real-time updates
    host: 'localhost',        // Accessible from dev machine
    port: 5173,               // Same as dev server
    timeout: 10_000,          // 10s before full reload fallback
  },
}
```

**What each setting does:**

| Setting | Purpose | Note |
|---------|---------|------|
| `protocol: 'ws'` | Use WebSocket for HMR updates | Faster than long-polling; required for local dev |
| `host: 'localhost'` | Where the HMR server listens | Use IP if accessing from different machine |
| `port: 5173` | Port for HMR WebSocket | Must match dev server port |
| `timeout: 10_000` | Fallback to full reload if HMR stalls for 10s | Prevents infinite hangs on slow networks |

## Utilities: src/utils/hmr.ts

Three optional hooks to improve HMR reliability when React Fast Refresh isn't enough:

### 1. useHmrState — Preserve State Across Reloads

When a component has complex state that shouldn't reset, use `useHmrState`:

```tsx
// Instead of:
const [count, setCount] = useState(0)

// Use:
import { useHmrState } from '../utils/hmr'
const [count, setCount] = useHmrState('counter', 0)
```

**What it does:**
- Saves state to `sessionStorage` on every change
- Restores state from `sessionStorage` on mount
- Survives HMR reloads and full page refreshes

**When to use:**
- Form state (user entered text, selected values)
- UI state (selected tabs, expanded sections)
- Modal visibility
- Scroll position (save manually)

### 2. useHmrAccept — Graceful HMR for Providers

When a component provides context or subscriptions, prevent full reloads:

```tsx
export const PriceProvider = ({ children }) => {
  useHmrAccept(() => {
    // Cleanup code if needed
    console.log('[HMR] PriceProvider updated')
  })

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  )
}
```

**What it does:**
- Tells Vite: "If I change, update me locally without full reload"
- Preserves subscriptions and connections
- Runs cleanup callback if provided

**When to use:**
- Context providers
- Custom hooks with side effects
- Components managing WebSocket connections

### 3. useHmrDebug — Debug HMR Issues

During development, see which components are being updated:

```tsx
export const Dashboard = () => {
  useHmrDebug('Dashboard')  // Logs "[HMR] Updated: Dashboard"
  // ... component code
}
```

Logs appear in the browser console whenever HMR updates that component. Useful for:
- Identifying which changes trigger full reloads
- Understanding component dependency chains
- Optimizing development experience

## Common Problems & Solutions

### Problem: HMR Takes 3+ Seconds

**Symptoms:** Save file → 2-3 second wait → changes appear

**Causes:**
- Large module (lots of imports)
- Complex bundling (circular dependencies, re-exports)
- Slow network to WebSocket server

**Solutions:**
1. Check Vite console for slow modules: Look for lines like `time: 1234ms`
2. Reduce bundle size: Split large files
3. Break circular dependencies: Use `src/utils/chunks.ts` for lazy-loaded components
4. Check network latency: Open DevTools → Network → check latency to `localhost:5173`

### Problem: HMR Does Full Reload and I Lose State

**Symptoms:** Save file → page refreshes → lose modal position, form input, etc.

**Causes:**
1. React Fast Refresh couldn't update that component
2. Component added/removed exports
3. Hook call added/removed

**Solutions:**

1. **For simple state, use useHmrState:**
   ```tsx
   const [open, setOpen] = useHmrState('modal-open', false)
   ```

2. **For form inputs, save on blur:**
   ```tsx
   <input
     defaultValue={savedValue}
     onBlur={(e) => sessionStorage.setItem('form-input', e.target.value)}
   />
   ```

3. **For providers/contexts, use useHmrAccept:**
   ```tsx
   export const MyProvider = ({ children }) => {
     useHmrAccept()
     return <Context.Provider>{children}</Context.Provider>
   }
   ```

4. **Accept component changes explicitly in tests/Storybook:**
   ```tsx
   if (import.meta.hot) {
     import.meta.hot.accept()
   }
   ```

### Problem: "WebSocket connection to localhost:5173 failed"

**Symptoms:** Console error: `WebSocket error: connection to ws://localhost:5173 failed`

**Causes:**
- Dev server not running
- Vite port changed
- Firewall blocking WebSocket

**Solutions:**
1. Check dev server is running: `npm run dev`
2. Check port: Browser console → check WebSocket URL matches `localhost:5173`
3. If accessing from different machine, update `hmr.host` in `vite.config.ts`
4. Use `host: '0.0.0.0'` to accept connections from any IP

### Problem: Changes Don't Show Up / HMR Seems Broken

**Symptoms:** Save file → no change in browser; might see stale cache

**Causes:**
- Browser cache (CSS, JS)
- Vite cache stale (`node_modules/.vite`)
- Module not reloaded (dependency not updated)

**Solutions:**
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Restart dev server: `Ctrl+C` in terminal, then `npm run dev`
4. Check file was actually saved (not in an editor conflict state)

### Problem: HMR Works for JSX But Not for CSS

**Symptoms:** Change CSS → no update; change JS → updates instantly

**Causes:**
- Tailwind CSS needs rebuild (rare with current setup)
- CSS module cache stale
- CSS import not detected by HMR

**Solutions:**
1. HMR for Tailwind CSS is built-in; try hard refresh (`Ctrl+Shift+R`)
2. Check CSS actually changed (editor might not be saving)
3. Restart dev server

## Best Practices

### 1. Keep Components Small

Large components with many branches are harder to HMR safely. Break into:
- **Container** (data fetching, state management) — Can't HMR easily
- **Presenter** (pure rendering) — HMR works great

```tsx
// ✓ Good: Presenters HMR reliably
export const PriceCardPresenter = memo(({ price, onClick }) => (
  <div onClick={() => onClick(price.assetPair)}>
    {price.assetPair}: {price.price}
  </div>
))

// Container: can do full reload if needed
export const PriceCard = ({ pair }) => {
  const { prices } = usePriceContext()
  const price = prices.find(p => p.assetPair === pair)
  return <PriceCardPresenter price={price} onClick={handleClick} />
}
```

### 2. Avoid Default Exports (Usually)

```tsx
// ✓ Good: Named exports HMR better
export const Dashboard = () => { ... }

// ✗ Problematic: Default export might trigger full reload
export default Dashboard
```

**Why:** Named exports let Vite track component identity better. Default exports confuse HMR when re-exported.

**Exception:** Route components and `src/main.tsx` can use defaults (they're expected to reload).

### 3. Use React.memo for List Items

```tsx
// ✓ Good: Memoized children HMR independently
export const PriceCard = memo(({ price }) => { ... })

// ✗ Bad: Inline component always re-renders with parent
const Dashboard = () => (
  {prices.map(p => <div>{p.price}</div>)}
)
```

### 4. Keep Hooks Simple

Complex hook logic can confuse HMR. Keep hooks focused:

```tsx
// ✓ Good: Single responsibility
const usePrice = (pair) => { ... }
const useAlert = (pair) => { ... }

// ✗ Bad: Too many effects and conditions
const usePriceAndAlert = (pair) => { ... }
```

### 5. Test HMR During Development

After editing a component, watch the browser:
- Does it update immediately (within 200ms)?
- Does your state persist (form inputs, modal open/close)?
- Is there any flicker or jank?

If HMR is slow, consider breaking the component up.

## Advanced: Custom HMR Accept

For edge cases where the utilities don't cover you:

```tsx
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    // Called when this module updates
    console.log('Module updated:', mod)
    // Cleanup old subscriptions, recreate if needed
  })

  import.meta.hot.dispose((data) => {
    // Called before this module is replaced
    // Save state to data object if needed
    data.previousState = someState
  })
}
```

See [Vite HMR API](https://vitejs.dev/guide/api-hmr.html) for full documentation.

## Monitoring HMR Health

Watch the Vite dev server output for HMR-related messages:

```
✓ [HMR] connected

[HMR] Reload [src/components/PriceCard.tsx]

[HMR] Hmm, something went wrong. Performing full reload on file change...
```

### Red flags:
- `[HMR] connected` doesn't appear → WebSocket not working
- `Hmm, something went wrong` → React Fast Refresh failed
- Long delays (2+ seconds) before update → Slow module

## Performance Tips for HMR

### 1. Use Code Splitting for Heavy Routes

```tsx
// ✓ Good: Lazy load dashboard, only HMR on this component
const Dashboard = lazy(() => import('./pages/Dashboard'))

// Usage
<Suspense fallback={<Skeleton />}>
  <Dashboard />
</Suspense>
```

### 2. Minimize Dependencies in Changed File

```tsx
// ✗ Bad: Changing this causes 50+ files to HMR
import * as Components from './components'

// ✓ Good: Specific imports only
import { PriceCard } from './components/PriceCard'
```

### 3. Use Absolute Imports

```tsx
// ✗ Bad: Unclear which file, harder to HMR
import { Component } from '../../../components/Component'

// ✓ Good: Clear path, easier to HMR
import { Component } from '@/components/Component'
```

If not configured, set up in `vite.config.ts`:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

## Questions & Troubleshooting

### "Do I need to add accept() to every component?"

No. React Fast Refresh is automatic. Only use `useHmrAccept()` when:
- You're managing subscriptions (WebSocket, Event listeners)
- You're providing context that shouldn't reset
- You explicitly need HMR without full reload

### "Why does Vite do a full reload sometimes?"

React Fast Refresh updates components in-place when possible. When it can't (new exports, signature changes), Vite reloads the page. This is safe but loses state.

Solutions:
- Use `useHmrState()` to save state
- Keep components focused (small changes = better HMR)
- Use `useHmrAccept()` for providers

### "Can I disable full reloads?"

You shouldn't—they're important for correctness. Instead:
- Optimize to reduce need for full reloads
- Use `useHmrState()` to preserve state across reloads
- Check if you can use `useHmrAccept()` instead

## Related Docs

- [Vite HMR Documentation](https://vitejs.dev/guide/api-hmr.html)
- [React Fast Refresh](https://github.com/pmndrs/react-fast-refresh)
- [ADR-003: Component Architecture](./adr/ADR-003-component-architecture.md) — Component patterns that HMR better

## Summary

| Issue | Solution | File |
|-------|----------|------|
| Slow HMR (2+ seconds) | Split components, reduce dependencies | vite.config.ts |
| State loss on HMR | Use `useHmrState()` | src/utils/hmr.ts |
| Full reload on changes | Use `useHmrAccept()` for providers | src/utils/hmr.ts |
| WebSocket error | Check dev server running, `npm run dev` | vite.config.ts |
| CSS not updating | Hard refresh `Ctrl+Shift+R` | - |
| Debugging HMR | Use `useHmrDebug()` in console | src/utils/hmr.ts |
