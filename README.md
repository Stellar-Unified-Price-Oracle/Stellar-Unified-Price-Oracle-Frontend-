[![CI](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-)
[![Bundle JS](https://img.shields.io/badge/JS-%3C200%20kB-44cc11?logo=javascript&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle CSS](https://img.shields.io/badge/CSS-%3C50%20kB-44cc11?logo=css3&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/Docs-API-blue)](docs/README.md)

# Stellar Unified Price Oracle — Frontend

**Developer Portal & Oracle Analytics Dashboard**

A real-time dashboard for the Stellar Unified Price Oracle & Aggregator. Displays aggregated price feeds from Chainlink, Redstone, Band, and Reflector — powered by the [Aggregator API](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Aggregator-API).

**Live Site:** https://stellar-price-oracle.example.com  
**API Documentation:** [docs/README.md](docs/README.md)  
**SDK Quickstarts:** [docs/sdk-quickstart.md](docs/sdk-quickstart.md)  
**Contributing Guide:** [CONTRIBUTING.md](CONTRIBUTING.md)  
**Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
**Security & Vulnerability Disclosure:** [SECURITY.md](SECURITY.md) · [/security](https://stellar-price-oracle.example.com/security) · [/.well-known/security.txt](https://stellar-price-oracle.example.com/.well-known/security.txt)  

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Prerequisites & Setup](#prerequisites--setup)
4. [Development Workflow](#development-workflow)
5. [Project Structure](#project-structure)
6. [Available Scripts](#available-scripts)
7. [Deployment](#deployment)
8. [Contributing](#contributing)
9. [Security](#security)
10. [Support & Resources](#support--resources)

## Features

- **Live price feeds** — Real-time updates via WebSocket with auto-reconnect
- **Multi-source aggregation** — See which oracles contributed to each price
- **Historical charts** — Area chart with price history for any asset pair
- **Source health** — Visual indicators for Chainlink, Redstone, Band & Reflector
- **Price alerts** — Set upper/lower threshold alerts with browser notifications
- **Inline help** — Tooltips explain oracle terminology directly in the UI
- **Responsive** — Works on desktop and mobile
- **Dark theme** — Low-light UI designed for monitoring dashboards

## Roadmap

- **On-chain publishing** — the aggregated price feed is published to Soroban
  oracle contracts on Stellar, so any dApp can read a verified price directly
  from the chain instead of trusting an off-chain API alone.
- **On-chain comparison in the dashboard** — `PriceDetail` compares the live
  off-chain price against the latest on-chain publish for that asset, with a
  configurable divergence threshold and alerting when the two disagree.

See [docs/on-chain.md](docs/on-chain.md) for the contract registry, read
interface, and a runnable client example against testnet.

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

### Local HTTPS Setup (Optional)

Service Workers, geolocation, and some WebSocket features require HTTPS. To enable local HTTPS:

```bash
# 1. Install mkcert (one-time)
brew install mkcert      # macOS
choco install mkcert     # Windows
sudo apt-get install mkcert  # Linux

# 2. Generate certificates
npm run setup-https

# 3. Start dev server with HTTPS
npm run dev:https
```

Access the app at `https://localhost:5173` (browser may show security warning, which is expected).

See [Local HTTPS Setup Guide](./docs/https-setup.md) for more information.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | REST API base URL |
| `VITE_WS_URL` | `ws://localhost:3000` | WebSocket endpoint |

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run dev:https` | Start the dev server with HTTPS (requires `npm run setup-https` first) |
| `npm run setup-https` | Generate local HTTPS certificates using mkcert |
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
| `npm run lhci` | Run Lighthouse CI locally against a production build |

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

### Lighthouse CI Budgets (#503)

The `Lighthouse CI` workflow (`.github/workflows/lighthouse.yml`) runs on every PR against a real
production build (`npm run build` + `vite preview`), checking the `/` and `/dashboard` routes:

| Metric | Budget |
|---|---|
| Largest Contentful Paint (LCP) | ≤ 2500 ms |
| Cumulative Layout Shift (CLS) | ≤ 0.1 |
| Total Blocking Time (TBT) | ≤ 300 ms |
| Accessibility score | ≥ 90 |

A violation fails the job. Results — including the delta against the last run on `main` — are
posted as a PR comment. Budgets live in [`.lighthouserc.json`](./.lighthouserc.json).

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

#### Security headers

`vercel.json` also sends a Content Security Policy plus HSTS, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` on every response.

The policy runs `script-src 'self'` — no `'unsafe-inline'`. Keep it that way: put startup
JavaScript in [`public/theme-init.js`](public/theme-init.js) rather than an inline `<script>`
block or an inline `on*` handler in [`index.html`](index.html), both of which CSP blocks.
`style-src` does allow `'unsafe-inline'`, which Tailwind and Recharts require.

`connect-src` is `'self' https: wss:` so that any `VITE_API_URL` / `VITE_WS_URL` works out of
the box. Once the backend origin is fixed for a deployment, narrow it to that origin.

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

Key architectural decisions are documented in [`docs/adr/`](docs/adr/). Start here to understand:

| ADR | Title | Focus |
|---|---|---|
| [ADR-001](docs/adr/ADR-001-state-management.md) | State Management Approach | React Context + Zustand hybrid, managing high-frequency vs. low-frequency updates |
| [ADR-002](docs/adr/ADR-002-data-fetching.md) | Data Fetching Strategy | WebSocket fast path + REST fallback, optimistic updates, deduplication, rate limiting |
| [ADR-003](docs/adr/ADR-003-component-architecture.md) | Component Architecture | Functional components, memoization conventions, composition layers |

**New contributors:** Read the ADRs in order to understand the system without diving into source code.

## License

MIT
