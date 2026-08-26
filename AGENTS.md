# AI Agent Guide — Stellar Unified Price Oracle (Frontend)

## Project Overview

A real-time price feed dashboard for the Stellar ecosystem. Aggregates prices from
Chainlink, Redstone, Band, and Reflector oracles into a unified view with live
WebSocket updates, configurable alerts, and export capabilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Routing | react-router-dom v7 |
| Testing | Vitest (unit) + Playwright (E2E) |
| Linting | ESLint + Prettier |
| Hooks | Husky (git hooks) |

## Directory Layout

```
.github/workflows/    — CI pipeline (single ci.yml)
.husky/               — Git hooks (pre-push: build + tests)
public/               — Static assets (favicon, manifest, service worker)
src/
  api/                — REST + WebSocket clients
  chart/              — Canvas chart engine
  components/         — Reusable UI components (PriceCard, Layout, etc.)
  config/             — Runtime config (env vars, defaults)
  context/            — React context providers (PriceContext, ToastContext)
  hooks/              — Custom hooks (useSwr, useAlerts, useExport, etc.)
  mocks/              — MSW handlers for dev/testing
  pages/              — Route-level page components (Dashboard, NotFound, PriceDetail)
  preferences/        — User preferences system (IndexedDB-backed, undo/redo)
  selectors/          — Memoized selectors
  test/               — Test helpers (FakeWebSocket, a11y utilities)
  types/              — TypeScript type definitions
  utils/              — Formatting, export helpers
  App.tsx             — Root app with routing
  main.tsx            — Entry point
  index.css           — Global styles (Tailwind)
```

## Key Commands

```sh
npm run dev          # Start Vite dev server
npm run build        # Type-check + production build
npm run typecheck    # TypeScript check only (no emit)
npm run lint         # ESLint
npm run test:run     # Vitest (CI mode)
npm test             # Vitest (watch mode)
npm run test:e2e     # Playwright E2E tests
npm run format       # Prettier
```

## Verification (run before marking any task done)

1. `npm run typecheck` — zero TypeScript errors
2. `npm run lint` — zero lint errors
3. `npm run build` — production build succeeds
4. `npm run test:run` — all unit tests pass
5. If E2E affected: `npm run test:e2e` — all Playwright tests pass

## CI Pipeline (`.github/workflows/ci.yml`)

Triggers on push/PR to `main`. Two jobs run sequentially:

1. **frontend** — typecheck → lint → build → unit tests
2. **e2e** (needs frontend) — Playwright on chromium, firefox, webkit

## Git Hooks

- **pre-push** (`./husky/pre-push`): runs `npm run build` then `npm run test:run`.
  Push is aborted if either fails.

## What to Push / Not Push

| Push | Never Push |
|------|-----------|
| Source files under `src/` | `node_modules/` (gitignored) |
| Config files (tsconfig, vite.config, etc.) | `dist/` (gitignored) |
| Tests (`.test.ts`, `.test.tsx`, `e2e/`) | `.env` / `.env.local` (gitignored) |
| CI workflows (`.github/workflows/`) | `.kiro/` or any AI-agent directories |
| Husky hooks (`.husky/`) | Local IDE config (`.vscode/`, `.idea/`) |
| `AGENTS.md` updates | Snapshot files that don't change |
| `package.json` / `package-lock.json` | Bundle analysis reports (`reports/`) |

## Known Issues

- **Tests fail on `SVGPathElement`**: jsdom doesn't implement SVGPathElement.
  The workaround in `src/test/setup.ts` mocks `getTotalLength`. If tests crash
  with `SVGPathElement is not defined`, the setup hasn't been applied.
- **This is a frontend-only repo**: There is no backend, contracts, or smart
  contract build in this repository. Any CI jobs for those would go elsewhere.
- **Confidence values are 0–1 (decimal)**: The PriceData type uses a 0–1 scale,
  not 0–100. Filter comparisons must use `> 0.8`, not `> 80`.

## Style Conventions

- No semicolons in JS/TS
- Single quotes for strings (Prettier default)
- 2-space indentation
- Tailwind utility classes for styling (no CSS modules)
- Named exports for components and hooks
- `memo()` wrapping for frequently re-rendered components

## Memoization Convention (`useCallback` / `useMemo`)

Memoize when it changes behaviour, not by reflex. Wrap a callback in `useCallback` when
**any** of these hold:

1. It is passed as a prop to a `memo()` component. An unmemoized callback gives that
   component a new prop identity every render, which defeats the `memo()` entirely.
2. It appears in a `useEffect` / `useMemo` / `useCallback` dependency array. A fresh
   identity each render makes the effect re-run every render.
3. It is returned from a custom hook or put on a context value, where the caller cannot
   see how it was built.

Do **not** wrap handlers passed only to host elements — `<button onClick={...}>`,
`<input onChange={...}>`. React does not re-render a DOM node because a listener's
identity changed, so the hook adds a dependency array to maintain and buys nothing.

Same rule for `useMemo`: use it for genuinely expensive work (filtering or sorting the
price list) or to stabilize an object/array identity that feeds rule 1 or 2. Do not use
it for cheap arithmetic or string building.

### Passing per-item callbacks to a memoized list child

The trap this convention exists to prevent:

```tsx
// Defeats PriceCard's memo() — a new closure per card, every render.
{items.map((p) => (
  <PriceCard key={p.assetPair} price={p} onClick={() => handleCardClick(p.assetPair)} />
))}
```

Give the child the identity instead and let it call back with it, so one stable handler
serves the whole list:

```tsx
// PriceCard invokes onClick(price.assetPair) internally.
{items.map((p) => (
  <PriceCard key={p.assetPair} price={p} onClick={handleCardClick} />
))}
```

## Client Storage Convention

All `localStorage` access goes through [`src/utils/storage.ts`](src/utils/storage.ts) —
never call `localStorage` directly. Keys are registered in `STORAGE_KEYS`, reads and
writes tolerate storage being unavailable, and `clearAllData()` can wipe everything the
app owns.

**Never persist tokens, API keys, signing secrets, passwords, or PII.** `localStorage` is
plain text and readable by any script on the origin, so one XSS bug leaks all of it.
Secrets stay in memory for the session (see the webhook secret in
`NotificationChannelsModal`) or move behind an httpOnly cookie set by the backend.


## Security Practices

### XSS Prevention

1. **React auto-escaping is default** — All JSX content is auto-escaped by default.
   Never use `dangerouslySetInnerHTML` without first sanitizing with DOMPurify (see below).

2. **Input sanitization** — User search input is sanitized via `sanitizeSearchInput()` in `utils/sanitize.ts`.
   All other user inputs (email, webhook URL, etc.) are validated by Zod before storage or use.

3. **URL validation** — Use `sanitizeUrl()` from `utils/htmlSanitizer.ts` to block dangerous protocols
   (javascript:, data:, vbscript:) when accepting user-provided URLs for `href` or `src` attributes.

4. **Never persist secrets** — Webhook signing secrets are session-only (stored in React state,
   not localStorage). Users must re-enter them after a reload.

5. **Centralized storage access** — Use `src/utils/storage.ts` for all localStorage/sessionStorage.
   Keys are namespaced (`supo:*`) and registered in `STORAGE_KEYS`.

6. **Environment variable validation** — All env vars are validated by Zod at startup
   (`src/config/validateEnv.ts`). URLs used in `href`, `src`, or API calls are safe.

7. **JSON parsing** — All JSON parsing is wrapped with Zod schema validation
   (`src/api/schemas.ts`). Invalid JSON is logged and replaced with safe defaults.

### HTML Content

If raw HTML ever needs to be rendered (e.g., Markdown, rich text):

```tsx
import { sanitizeHtml } from '../utils/htmlSanitizer'

const clean = sanitizeHtml(userHtml)
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

For plain text only, use `stripHtml()` to remove all formatting:

```tsx
import { stripHtml } from '../utils/htmlSanitizer'

const plainText = stripHtml(userInput)
<p>{plainText}</p>
```

### Content Security Policy

CSP headers enforce `script-src 'self'` (no inline scripts).
Startup JavaScript lives in [`public/theme-init.js`](public/theme-init.js), not inline `<script>` tags.
See [`vercel.json`](vercel.json) for the full security header list.

### Security Resources

- **XSS Audit:** See [`XSS_AUDIT_REPORT.md`](XSS_AUDIT_REPORT.md) for a comprehensive audit of all XSS vectors.