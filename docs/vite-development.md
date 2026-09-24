# Vite Development Optimization Guide

Vite is blazingly fast, but there are tricks to keep it that way as your codebase grows.

## Starting the Dev Server

```bash
npm run dev
```

This starts Vite on `http://localhost:5173` with:
- Hot Module Replacement (HMR) via WebSocket
- Automatic proxy to API (`/api` → `http://localhost:3000`)
- Automatic proxy to WebSocket (`/ws` → `ws://localhost:3000`)
- Tailwind CSS Just-in-Time compilation
- TypeScript type-checking (via Vite, not tsc)

## Common Dev Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build (minified, optimized) |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Run ESLint |
| `npm run format` | Auto-format with Prettier |

## Dev Server Performance

### Slow Dev Server? Check These:

1. **Is dev server hanging on startup?**
   ```bash
   npm run dev
   ```
   Should see `VITE v[X] ready in [Xms]` within 3 seconds.
   
   If slow, check:
   - Plugins: Tailwind CSS Vite plugin might take time on first run
   - TypeScript: Check if TypeScript is compiling in background

2. **HMR taking 2+ seconds to update?**
   - Check Vite console for slow modules
   - Look for messages like `> 500ms: src/components/Dashboard.tsx`
   - Break that component into smaller pieces

3. **Memory usage creeping up?**
   - Vite caches compiled modules in memory
   - Restart dev server: `Ctrl+C`, then `npm run dev`
   - Check `node_modules/.vite` cache size: `du -sh node_modules/.vite`

### Optimization Tips:

#### 1. Keep Imports Specific
```typescript
// ✗ Bad: Imports entire library into dev server memory
import * as Components from './components'

// ✓ Good: Only import what you use
import { PriceCard } from './components/PriceCard'
```

#### 2. Use Code Splitting
```typescript
// ✓ Good: Lazy load heavy components
const Dashboard = lazy(() => import('./pages/Dashboard'))

// Routes lazy-load too
<Route path="/dashboard" element={<Suspense><LazyDashboard /></Suspense>} />
```

#### 3. Avoid Circular Dependencies
```typescript
// ✗ Bad: A imports B imports A (confuses Vite)
// types.ts → exports Type
// utils.ts → imports Type, exports util
// types.ts → imports util (circular!)

// ✓ Good: Extract types into separate file
// types.ts → pure types
// utils.ts → imports types, exports utils
```

Run `npm run build` to detect circular dependencies.

#### 4. Cache Busting
Sometimes Vite's cache gets stale:

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Hard refresh browser (not just F5)
Ctrl+Shift+R  (Windows/Linux)
Cmd+Shift+R   (Mac)
```

## Environment Variables

Environment variables are prefixed `VITE_` and available at build time:

```typescript
// src/config/index.ts
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD
```

### Setting Environment Variables:

1. **Create `.env` file:**
   ```
   VITE_API_URL=http://localhost:3000
   VITE_WS_URL=ws://localhost:3000
   ```

2. **Or set in environment:**
   ```bash
   VITE_API_URL=http://api.example.com npm run dev
   ```

3. **Override in env files:**
   ```
   .env                  # Default (committed)
   .env.local            # Local overrides (ignored by git)
   .env.development      # Dev-only settings
   .env.production       # Production settings
   ```

See `.env.example` for available variables.

## Debugging

### Browser DevTools

1. **React DevTools**
   - Install: Search "React Developer Tools" in Chrome/Firefox extensions
   - Use: DevTools → Components tab
   - Features: Inspect component props, edit state, trace renders

2. **Redux DevTools** (for Zustand stores)
   - Install: Search "Redux DevTools" in Chrome/Firefox extensions
   - Use: DevTools → Redux tab
   - Features: Time-travel debugging, dispatch actions

3. **Vite DevTools** (inspect modules, HMR)
   - Built-in: Open DevTools → Console → look for Vite messages

### Console Debugging

```typescript
// Log render count
useRenderTracker('ComponentName')  // Logs in console

// Debug HMR
useHmrDebug('ComponentName')  // Logs "[HMR] Updated: ComponentName"

// Log network requests
// Already done: See Network tab in DevTools

// Log WebSocket messages
// In src/api/websocket.ts, search for console.log
```

### Performance Profiling

1. **React Profiler**
   - DevTools → Profiler tab
   - Click ● to record
   - Interact with app
   - Click ■ to stop
   - Inspect which components re-rendered, how long each took

2. **Network throttling**
   - DevTools → Network tab
   - Throttle to "Slow 3G" to test mobile experience
   - Check API response times

3. **Lighthouse**
   - DevTools → Lighthouse tab
   - Audit current page
   - Get scores for Performance, Accessibility, SEO

## Proxy Configuration

Dev server proxies API and WebSocket requests:

```
Browser request → Vite dev server → Proxy → Backend
  /api/prices      →      →        →   http://localhost:3000/api/prices
  /ws              →      →        →   ws://localhost:3000/ws
```

### Customizing Proxies:

In `vite.config.ts`, proxies are built from environment variables:

```typescript
VITE_PROXY_API='{"target":"http://localhost:3000","changeOrigin":true}'
VITE_PROXY_WS='{"target":"ws://localhost:3000","ws":true}'

// Or simpler:
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Connecting to Remote Backend:

```bash
VITE_API_URL=https://api.example.com npm run dev
```

Now `/api` requests go to `https://api.example.com`, but frontend stays on `localhost:5173`.

## Troubleshooting

### "Module not found" errors that disappear after restart

**Cause:** Vite cached an import before the file existed

**Solution:**
```bash
rm -rf node_modules/.vite
npm run dev
```

### "Cannot find module" in imports with `@/` alias

**Cause:** TypeScript path alias not configured in Vite

**Solution:** Already configured in `vite.config.ts`, but if not:

```typescript
// vite.config.ts
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Dev server crashes with memory error

**Cause:** Too many files, Vite cache too large

**Solution:**
```bash
# Clear cache
rm -rf node_modules/.vite

# Restart
npm run dev

# If still crashes, check for memory leaks in plugins
# Restart your computer if desperate
```

### "HMR connection failed" in production build

**Cause:** HMR is a dev-only feature; shouldn't appear in prod

**Solution:** If you see this in production, something is wrong:
1. Make sure you're running the dev server (`npm run dev`), not the production build
2. If running `npm run preview`, HMR won't work (it's a production preview)

### Large bundle size or slow build

Check bundle analysis:

```bash
npm run build:analyze
```

Opens an interactive HTML treemap showing which packages are largest. Look for:
- Duplicate packages (npm install issue)
- Unexpectedly large packages
- Assets that should be lazy-loaded

## TypeScript in Vite

Vite uses `esbuild` for TypeScript compilation (not `tsc`). This is much faster but has limitations:

### Transpilation Only

Vite compiles TS → JS but **does not type-check**. That's why we have:

```bash
npm run typecheck    # Run tsc to check types
npm run build        # Builds code (no type check)
npm run build && npm run typecheck  # Full check + build
```

### Configuration

TypeScript settings are in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",        // Browser compatibility
    "module": "ESNext",        // Use ES modules
    "lib": ["ES2020", "DOM"],  // APIs available
    "strict": true,            // Strict mode enabled
  }
}
```

## Tailwind CSS

Tailwind CSS integration is automatic via `@tailwindcss/vite` plugin:

```typescript
// src/index.css
@import "tailwindcss";
```

On first save, Tailwind scans `src/**/*.{ts,tsx}` for class names and generates CSS.

### Tips:

1. **Use string literals, not variables:**
   ```tsx
   // ✓ Good: Tailwind finds this
   <div className="bg-blue-500">

   // ✗ Bad: Tailwind can't find this
   const color = 'bg-blue-500'
   <div className={color}>
   ```

2. **Slow CSS generation?**
   - First build scans all files (slow)
   - Subsequent saves are instant
   - If still slow, check for large CSS files

3. **Dark mode**
   - Already configured as `class` mode
   - Add `dark` class to `<html>` to enable dark mode
   - Handled by `useTheme()` hook

## Browser Compatibility

Vite targets modern browsers by default. To support older browsers:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2015',  // Target ES2015 instead of ES2020
  },
})
```

But keep it modern (ES2020) for dev server and better performance.

## Next Steps

- Read [ADR-003: Component Architecture](./adr/ADR-003-component-architecture.md) for optimal component structure
- Check [HMR Optimization Guide](./hmr-optimization.md) for faster development
- Run `npm run build:analyze` to understand your bundle
- Use React DevTools Profiler to identify slow components

## Quick Reference

| Problem | Solution |
|---------|----------|
| Slow dev server startup | Clear cache: `rm -rf node_modules/.vite` |
| HMR takes 2+ seconds | Break component into smaller pieces |
| State lost on save | Use `useHmrState()` from `src/utils/hmr.ts` |
| Module not found | Restart dev server |
| Broken imports with `@/` | Already configured (check tsconfig.json) |
| Build too large | Run `npm run build:analyze` |
| TypeScript errors not caught | Run `npm run typecheck` |
| CSS not updating | Hard refresh: `Ctrl+Shift+R` |
