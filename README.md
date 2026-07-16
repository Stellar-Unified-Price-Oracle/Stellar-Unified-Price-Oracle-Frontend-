[![CI](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle JS](https://img.shields.io/badge/JS-%3C200%20kB-44cc11?logo=javascript&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle CSS](https://img.shields.io/badge/CSS-%3C50%20kB-44cc11?logo=css3&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Stellar Unified Price Oracle — Frontend

**Developer Portal & Oracle Analytics Dashboard**

A real-time dashboard for the Stellar Unified Price Oracle & Aggregator. Displays aggregated price feeds from Chainlink, Redstone, Band, and Reflector — powered by the [Aggregator API](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Aggregator-API).

## Features

- **Live price feeds** — Real-time updates via WebSocket with auto-reconnect
- **Multi-source aggregation** — See which oracles contributed to each price
- **Historical charts** — Area chart with price history for any asset pair
- **Source health** — Visual indicators for Chainlink, Redstone, Band & Reflector
- **Price alerts** — Set upper/lower threshold alerts with browser notifications
- **Inline help** — Tooltips explain oracle terminology directly in the UI
- **Responsive** — Works on desktop and mobile
- **Dark theme** — Low-light UI designed for monitoring dashboards

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Routing | React Router v7 |
| Virtualization | @tanstack/react-virtual |
| Real-time | Native WebSocket |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env

# 3. Start the dev server (proxies /api and /ws to localhost:3000)
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | REST API base URL |
| `VITE_WS_URL` | `ws://localhost:3000` | WebSocket endpoint |

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check and build for production (outputs to `dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run tests in watch mode (Vitest) |
| `npm run test:run` | Run tests once and exit |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format source files with Prettier |
| `npm run format:check` | Check formatting without writing files |
| `npm run build:analyze` | Build and open an interactive bundle treemap |
| `npm run size-limit` | Check bundle size against CI budgets |

## Build

```bash
npm run build          # outputs to dist/
npm run build:analyze  # build + generate bundle analysis report (reports/bundle-stats.html)
npm run size-limit     # check bundle size against configured budgets
npm run preview        # preview production build locally
```

### Bundle Size Budgets

| Asset | Limit | Status |
|---|---|---|
| JavaScript (entry) | 200 kB | Enforced in CI |
| JavaScript (total) | 600 kB | Enforced in CI |
| CSS | 50 kB | Enforced in CI |

The CI pipeline generates a [bundle-stats.html](./reports/bundle-stats.html) report using `rollup-plugin-visualizer` — an interactive treemap of the production bundle. This report is uploaded as a CI artifact on every build.

## API Endpoints Consumed

| Method | Path | Source |
|---|---|---|
| `GET` | `/api/prices` | All latest prices |
| `GET` | `/api/prices/:pair` | Single pair price |
| `GET` | `/api/prices/:pair/history` | Price history |
| `POST` | `/api/prices/history/batch` | Batch price history (coalesced) |
| `GET` | `/health` | API server health |
| `WS` | `/ws` | Real-time price updates |

## Architecture

```
Browser
  │
  ├─ PriceProvider (React Context)
  │    ├─ WebSocketClient ──────────────────► WS /ws
  │    │    └─ price_update events
  │    │         └─ optimistic update → REST confirm/rollback
  │    └─ useSwr (polling) ────────────────► GET /api/prices
  │
  ├─ AlertsProvider (React Context)
  │    └─ threshold eval against live prices → browser notifications
  │
  └─ Pages / Components
       ├─ Dashboard ─ PriceCard, PriceTableView
       ├─ ConnectionBadge (WebSocket status)
       ├─ SourceHealthBadge (per-oracle indicator)
       └─ AlertPanel / AlertModal
```

Data flow for a live update:

```
WS message → PriceContext (optimistic) → component re-render
                  └─► REST /api/prices/:pair
                            ├─ match → syncState: confirmed
                            └─ mismatch → syncState: rollback (REST value wins)
```

## Deployment

### Vercel

The repo ships with a [`vercel.json`](vercel.json) that rewrites all routes to `index.html` for client-side routing:

```bash
npm install -g vercel
vercel --prod
```

Set `VITE_API_URL` and `VITE_WS_URL` as environment variables in the Vercel project settings.

### Netlify

A [`netlify.toml`](netlify.toml) is included with the equivalent redirect rule:

```bash
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

### Static hosting (generic)

```bash
npm run build
# Upload the contents of dist/ to any static host.
# Configure the server to serve index.html for all 404 routes.
```

## Directory Structure

```
src/
├── api/          # REST + WebSocket clients
├── components/   # Reusable UI components
├── config/       # Environment configuration
├── context/      # React context providers
├── hooks/        # React hooks for data fetching and alerts
├── pages/        # Route pages
├── test/         # Test utilities and setup
├── types/        # TypeScript definitions
└── utils/        # Formatting and export helpers
docs/
└── adr/          # Architecture Decision Records
```

## Architecture Decision Records

Key architectural decisions are documented in [`docs/adr/`](docs/adr/):

| ADR | Decision |
|---|---|
| [ADR-001](docs/adr/ADR-001-react-vite-typescript.md) | React + Vite + TypeScript |
| [ADR-002](docs/adr/ADR-002-state-management.md) | State management strategy |
| [ADR-003](docs/adr/ADR-003-websocket-vs-polling.md) | WebSocket vs polling architecture |
| [ADR-004](docs/adr/ADR-004-tailwind-css.md) | Tailwind CSS for styling |
| [ADR-005](docs/adr/ADR-005-error-handling.md) | Error handling strategy |

## License

MIT
