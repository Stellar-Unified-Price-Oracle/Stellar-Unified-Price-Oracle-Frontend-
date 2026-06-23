[![CI](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle JS](https://img.shields.io/badge/JS-%3C200%20kB-44cc11?logo=javascript&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle CSS](https://img.shields.io/badge/CSS-%3C50%20kB-44cc11?logo=css3&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)

# Stellar Unified Price Oracle — Frontend

**Developer Portal & Oracle Analytics Dashboard**

A real-time dashboard for the Stellar Unified Price Oracle & Aggregator. Displays aggregated price feeds from Chainlink, Redstone, Band, and Reflector — powered by the [Aggregator API](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Aggregator-API).

## Features

- **Live price feeds** — Real-time updates via WebSocket with auto-reconnect
- **Multi-source aggregation** — See which oracles contributed to each price
- **Historical charts** — Area chart with price history for any asset pair
- **Source health** — Visual indicators for Chainlink, Redstone, Band & Reflector
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
| Real-time | Native WebSocket |

## Getting Started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/api` and `/ws` to `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env` to override defaults:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | REST API base URL |
| `VITE_WS_URL` | `ws://localhost:3000` | WebSocket endpoint |

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
| JavaScript | 200 kB | Enforced in CI |
| CSS | 50 kB | Enforced in CI |

The CI pipeline generates a [bundle-stats.html](./reports/bundle-stats.html) report using `rollup-plugin-visualizer` — an interactive treemap of the production bundle. This report is uploaded as a CI artifact on every build.

## API Endpoints Consumed

| Method | Path | Source |
|---|---|---|
| `GET` | `/api/prices` | All latest prices |
| `GET` | `/api/prices/:pair` | Single pair price |
| `GET` | `/api/prices/:pair/history` | Price history |
| `WS` | `/ws` | Real-time price updates |

## Directory Structure

```
src/
├── api/          # REST + WebSocket clients
├── components/   # Reusable UI components
├── config/       # Environment configuration
├── hooks/        # React hooks for data fetching
├── pages/        # Route pages
└── types/        # TypeScript definitions
```

## License

MIT
