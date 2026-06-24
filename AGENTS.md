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
| Virtualization | @tanstack/react-virtual |
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
  components/         — Reusable UI components (PriceCard, Layout, etc.)
  config/             — Runtime config (env vars, defaults)
  context/            — React context providers (PriceContext, ToastContext)
  hooks/              — Custom hooks (usePrices, useAlerts, useExport, etc.)
  pages/              — Route-level page components (Dashboard, NotFound)
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
