[![CI](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle JS](https://img.shields.io/badge/JS-%3C200%20kB-44cc11?logo=javascript&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![Bundle CSS](https://img.shields.io/badge/CSS-%3C50%20kB-44cc11?logo=css3&labelColor=1a1a2e)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/Docs-API-blue)](docs/README.md)

# Stellar Unified Price Oracle — Frontend

**Developer Portal & Oracle Analytics Dashboard**

A real-time monitoring dashboard for the Stellar Unified Price Oracle & Aggregator. Aggregates price data from **Chainlink, Redstone, Band, and Reflector** oracles into a unified interface powered by the [Aggregator API](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Aggregator-API).

**🌐 Live Site:** https://stellar-price-oracle.example.com  
**📖 API Docs:** [docs/README.md](docs/README.md)  
**🤝 Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)  
**📐 Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  

---

## Table of Contents

1. [Quick Start](#quick-start) — Get running in 5 minutes
2. [Project Overview](#project-overview) — Understand what this is
3. [Architecture](#architecture) — System design & data flow
4. [Prerequisites](#prerequisites) — What you need
5. [Setup & Installation](#setup--installation) — Step-by-step guide
6. [Development Workflow](#development-workflow) — How to contribute
7. [Project Structure](#project-structure) — File organization
8. [Available Scripts](#available-scripts) — npm commands
9. [Deployment](#deployment) — Deploy to production
10. [Contributing](#contributing) — Guidelines & standards
11. [Security](#security) — Security practices
12. [Resources](#resources) — Docs & support

---

## Quick Start

Get the frontend running locally in **3 minutes:**

```bash
# 1. Clone repo
git clone https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-.git
cd Stellar-Unified-Price-Oracle-Frontend-

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start dev server
npm run dev

# 5. Open browser
# Visit http://localhost:5173
```

✅ That's it! The app will start with mock data by default.

**Next Steps:**
- Read [Project Overview](#project-overview) to understand the codebase
- See [Prerequisites](#prerequisites) for system requirements
- Check [Development Workflow](#development-workflow) before making changes

---

## Project Overview

### What is This?

The Stellar Unified Price Oracle Frontend is a **real-time monitoring dashboard** that:

1. **Aggregates prices** from multiple blockchain oracle sources
2. **Displays live updates** via WebSocket with automatic reconnection
3. **Tracks source health** — shows which oracles are active and their quality
4. **Manages alerts** — set price thresholds and get notifications
5. **Visualizes history** — charts showing price trends over time
6. **Exports data** — download prices as CSV, JSON, or PDF

### Who Uses It?

- **Developers** — Learn how oracle aggregation works
- **Traders** — Monitor real-time prices from multiple sources
- **Analysts** — Analyze price history and source reliability
- **Integration Teams** — Reference implementation for the Oracle API

### Key Statistics

```
TypeScript Files    224
Components         80+
Custom Hooks       30+
Test Files         50+
Lines of Code      15,000+
Bundle Size        <200 kB (JS), <50 kB (CSS)
Test Coverage      >80%
Uptime SLA         99.9%
```

### Features

✅ **Live Price Feeds** — Real-time WebSocket updates with <100ms latency  
✅ **Multi-Oracle Display** — See Chainlink, Redstone, Band, Reflector prices  
✅ **Price Charts** — Historical data visualization with area charts  
✅ **Source Health** — Visual indicators for oracle status (healthy/degraded/down)  
✅ **Price Alerts** — Set thresholds and receive browser notifications  
✅ **Data Export** — Download as CSV, JSON, or PDF  
✅ **Responsive Design** — Works on mobile, tablet, desktop  
✅ **Dark Theme** — Optimized for 24/7 monitoring dashboards  
✅ **Accessible** — WCAG 2.1 AA compliant, keyboard navigation  
✅ **High Performance** — Virtualized lists render 1000+ items smoothly  
✅ **Type-Safe** — Strict TypeScript with 100% coverage  
✅ **Secure** — XSS prevention, CSP headers, no secrets in storage  

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Frontend)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Components                                    │   │
│  │  ├─ Dashboard (main page)                           │   │
│  │  ├─ PriceCard (individual prices)                   │   │
│  │  ├─ AlertPanel (alert configuration)                │   │
│  │  ├─ Charts (price history visualization)            │   │
│  │  └─ 80+ other components                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ▲                                   │
│  ┌──────────────────────┴─────────────────────────────┐     │
│  │    React Context Providers                         │     │
│  │    ├─ PriceContext (live prices, sync state)      │     │
│  │    ├─ AlertsContext (alert evaluation)            │     │
│  │    ├─ PreferencesContext (user settings)          │     │
│  │    └─ ToastContext (notifications)                │     │
│  └───────┬──────────────────────────────────┬────────┘     │
│          │                                  │               │
│   ┌──────▼──────┐            ┌──────────────▼─────┐        │
│   │ WebSocket   │            │   REST API Client   │        │
│   │ Client      │            │   (SWR + batching)  │        │
│   └──────┬──────┘            └──────────────┬─────┘        │
│          │                                  │               │
└──────────┼──────────────────────────────────┼───────────────┘
           │                                  │
    ┌──────▼──────┐              ┌────────────▼─────┐
    │  wss://api/ │              │ https://api/     │
    │    ws       │              │ prices           │
    │ (Real-time) │              │ (Fallback/Batch) │
    └─────────────┘              └──────────────────┘
           │                                  │
           └──────────────────────────────────┘
                       ▼
            ┌──────────────────────┐
            │  Oracle Aggregator   │
            │    API Backend       │
            │                      │
            │ ┌────────────────┐   │
            │ │ Price Feed     │   │
            │ ├─ Chainlink     │   │
            │ ├─ Redstone      │   │
            │ ├─ Band Protocol │   │
            │ └─ Reflector     │   │
            └──────────────────────┘
```

### Data Flow: Real-Time Price Update

```
1. Oracle Backend detects price change
   ↓
2. Server sends WS message to client
   ↓
3. WebSocketClient receives price_update
   ├─ Parse message
   └─ Dispatch to PriceContext
   ↓
4. PriceContext updates state (optimistic)
   ├─ Update price immediately
   ├─ Set syncState: 'optimistic'
   └─ Increment flashVersion (for animations)
   ↓
5. Component re-renders with new price
   ├─ User sees update instantly
   └─ Shows animated flash effect
   ↓
6. Background REST call (verification)
   ├─ Fetch /api/prices/:pair
   ├─ Compare with WS value
   └─ Timeout: 5 seconds max
   ↓
7. Confirmation logic
   ├─ Match → syncState: 'confirmed' ✅
   ├─ Mismatch → syncState: 'rollback' (REST wins)
   └─ Timeout → syncState: 'synced'
   ↓
8. Update UI with confirmed state + confidence score
```

### Data Flow: Alert Trigger

```
1. Price update received (from WS or REST)
   ↓
2. AlertsContext evaluates all active alerts
   ├─ Absolute threshold: price > upper OR price < lower
   └─ Percentage threshold: % change > threshold in window
   ↓
3. Alert conditions met
   ├─ Create browser notification
   ├─ Store in alert history (IndexedDB)
   ├─ Apply cooldown (for persistent alerts)
   └─ Display toast in UI
   ↓
4. Notification shown
   ├─ Browser notification (if permission granted)
   ├─ Toast in app UI
   └─ Alert history record
   ↓
5. User can snooze or dismiss
```

## Prerequisites

### System Requirements

| Tool | Minimum | Recommended | Check |
|------|---------|-------------|-------|
| Node.js | 18.0 | 20.x LTS | `node --version` |
| npm | 9.0 | 10.x | `npm --version` |
| Git | 2.30 | 2.40+ | `git --version` |

### Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari 14+, Chrome Mobile)

### Verify Installation

```bash
# Check Node.js (should be v18+)
node --version

# Check npm (should be v9+)
npm --version

# Check Git (should be v2.30+)
git --version
```

If any is missing, install from:
- **Node.js:** https://nodejs.org (includes npm)
- **Git:** https://git-scm.com

## Setup & Installation

### Step 1: Clone Repository

```bash
# Using HTTPS (recommended for first-time)
git clone https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-.git
cd Stellar-Unified-Price-Oracle-Frontend-

# OR using SSH (if you have SSH key configured)
git clone git@github.com:Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-.git
cd Stellar-Unified-Price-Oracle-Frontend-
```

### Step 2: Install Dependencies

```bash
# Install all npm dependencies
npm install

# Verify installation completed successfully
npm list react react-dom vite

# If you see versions listed, you're good!
# Example output:
# ├── react@19.0.0
# ├── react-dom@19.0.0
# └── vite@6.0.0
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env if needed (optional, defaults work for local dev)
# nano .env    # or use your editor
```

**Default `.env` (suitable for local development):**

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
VITE_USE_MOCK=false
VITE_LOG_LEVEL=warn
```

**For production deployment:**

```env
VITE_API_URL=https://api.stellar-oracle.example.com/api
VITE_WS_URL=wss://api.stellar-oracle.example.com
VITE_OPENAPI_SPEC_URL=https://api.stellar-oracle.example.com/openapi.json
```

### Step 4: Start Development Server

```bash
# Start Vite dev server with hot reload
npm run dev

# Output will show:
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help

# Open http://localhost:5173 in your browser
```

### Step 5: Verify Installation

✅ Check these in your browser:

- Page loads without errors (check DevTools Console)
- Dashboard displays with price data
- Dark theme is applied
- Network tab shows API requests

### Troubleshooting Setup

| Issue | Solution |
|-------|----------|
| Port 5173 already in use | `npm run dev -- --port 3001` |
| `npm install` fails | Delete `node_modules/` and `package-lock.json`, then `npm install` |
| Module not found errors | `npm install` again, restart dev server |
| CORS errors | Check `VITE_API_URL` points to a running backend |
| WebSocket connection fails | Verify `VITE_WS_URL` and backend is running |

### Optional: Backend Setup

To run against a local backend:

```bash
# Clone and run the aggregator API
git clone https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Aggregator-API.git
cd Stellar-Unified-Price-Oracle-Aggregator-API

# Follow repo's setup instructions (usually Docker)
docker-compose up

# Verify it's running
curl http://localhost:3000/health
# Should return: {"status":"healthy","uptime":123}

# Now frontend can connect to it
# Make sure .env has:
# VITE_API_URL=http://localhost:3000/api
# VITE_WS_URL=ws://localhost:3000
```

## Development Workflow

### Branching Strategy

We use **Git Flow** branching model:

```
main                   (production, always stable)
  ↓ (merge PR)
develop                (integration, next release)
  ↓
feature/my-feature     (your work)
bugfix/my-bug          (bug fix)
hotfix/critical-bug    (emergency fix)
```

**In practice:**

1. Always base work on `develop` branch
2. Create feature branches: `feature/description`
3. Submit PR to merge back to `develop`
4. After PR approval, maintainer merges to `main` (release)

### Creating a Feature Branch

```bash
# 1. Fetch latest changes
git fetch origin
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/awesome-feature

# 3. Make your changes, test, commit
git add .
git commit -m "feat: add awesome feature"

# 4. Push to remote
git push -u origin feature/awesome-feature

# 5. Create Pull Request on GitHub
# (web interface will prompt you after push)
```

### Commit Message Convention

We follow **Conventional Commits**:

```
<type>(<scope>): <short description>

<optional body explaining the change>

<optional footer with references>
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `style:` — Code formatting (not affecting behavior)
- `refactor:` — Code reorganization
- `perf:` — Performance improvement
- `test:` — Adding/updating tests
- `chore:` — Maintenance tasks

**Examples:**

```bash
git commit -m "feat(prices): add real-time WebSocket streaming"
git commit -m "fix(websocket): handle reconnection timeout"
git commit -m "docs(readme): add development setup guide"
git commit -m "refactor(alerts): simplify threshold logic"
```

### Code Review Process

1. **Push your feature branch** to GitHub
2. **Create Pull Request** with:
   - Clear title: "feat: description"
   - Description of changes
   - Linked issue number
   - Test instructions
3. **Automated checks run:**
   - ✅ TypeScript compilation
   - ✅ ESLint linting
   - ✅ Prettier formatting
   - ✅ Unit tests (Vitest)
   - ✅ E2E tests (Playwright)
   - ✅ Bundle size limits
4. **Manual code review:** 2+ approvals needed
5. **Merge:** Maintainer merges after approvals
6. **Cleanup:** Remote branch deleted

### Before Submitting PR

**Run full verification:**

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Code formatting
npm run format

# Unit tests
npm run test:run

# Production build
npm run build

# Bundle size check
npm run size-limit

# OR run all at once:
npm run typecheck && npm run lint && npm run test:run && npm run build
```

**If all pass, you're ready to commit and push!**

### PR Review Guidelines

**What reviewers look for:**

- ✅ Code quality and consistency with project style
- ✅ Type safety (no `any` without justification)
- ✅ Test coverage (>80% for new code)
- ✅ Performance impact
- ✅ Security (XSS, injection, storage)
- ✅ Accessibility (keyboard, screen readers)
- ✅ Documentation (comments, README updates)
- ✅ No merge conflicts

**Tips for getting PR approved:**

- Make smaller, focused PRs (easier to review)
- Write clear commit messages
- Include test cases
- Document complex logic
- Be responsive to feedback
- Ask for help if stuck

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI/CD pipeline (GitHub Actions)
│
├── .husky/
│   └── pre-push                     # Git hook (runs build + tests)
│
├── public/
│   ├── favicon.svg                  # App icon
│   ├── manifest.json                # PWA manifest
│   ├── service-worker.js            # Service worker
│   └── theme-init.js                # Startup script (no CSP issues)
│
├── src/
│   ├── api/
│   │   ├── rest.ts                  # REST API client
│   │   ├── websocket.ts             # WebSocket client
│   │   ├── schemas.ts               # Zod validation
│   │   └── ...
│   │
│   ├── components/
│   │   ├── PriceCard.tsx            # Single price display
│   │   ├── PriceTableView.tsx       # Prices table
│   │   ├── AlertModal.tsx           # Alert UI
│   │   ├── Layout.tsx               # Main layout
│   │   └── ...                      # 80+ components
│   │
│   ├── context/
│   │   ├── PriceContext.tsx         # Live prices provider
│   │   ├── AlertsContext.tsx        # Alerts provider
│   │   └── ...
│   │
│   ├── hooks/
│   │   ├── useSwr.ts                # Data fetching
│   │   ├── useAlerts.tsx            # Alert management
│   │   ├── useExport.ts             # Data export
│   │   └── ...                      # 30+ hooks
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx            # Main page
│   │   ├── PriceDetail.tsx          # Single price detail
│   │   ├── ApiDocs.tsx              # API documentation
│   │   └── NotFound.tsx             # 404 page
│   │
│   ├── types/
│   │   ├── price.ts                 # Price data types
│   │   └── ...
│   │
│   ├── utils/
│   │   ├── format.ts                # Number/date formatting
│   │   ├── export.ts                # CSV/JSON export
│   │   ├── sanitize.ts              # Input sanitization
│   │   ├── htmlSanitizer.ts         # HTML sanitization (XSS)
│   │   └── storage.ts               # localStorage wrapper
│   │
│   ├── App.tsx                      # Root component
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles
│
├── docs/
│   ├── README.md                    # API documentation
│   ├── QUICKSTART.md                # 5-minute start
│   ├── API.md                       # Full API reference
│   ├── ERRORS.md                    # Error handling
│   └── openapi.yaml                 # OpenAPI spec
│
├── .env.example                     # Example env file
├── .eslintrc.js                     # ESLint config
├── .prettierrc.json                 # Prettier config
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite config
├── vitest.config.ts                 # Vitest config
├── playwright.config.ts             # E2E test config
├── package.json                     # Dependencies
├── README.md                        # This file
├── CONTRIBUTING.md                  # Contributing guide
├── AGENTS.md                        # Code style guide
├── LICENSE                          # MIT license
└── .gitignore                       # Git ignore rules
```

## Available Scripts

### Development & Testing

```bash
npm run dev              # Start dev server (http://localhost:5173)
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once (CI mode)
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # Open Playwright UI for debugging
```

### Code Quality

```bash
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint code linting
npm run lint --fix       # Auto-fix linting issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting (no changes)
```

### Building & Analysis

```bash
npm run build            # Production build
npm run build:analyze    # Build + open bundle analysis
npm run preview          # Preview production build
npm run size-limit       # Check bundle size limits
```

### Verification Checklist

Before committing, run:

```bash
# Quick check
npm run typecheck && npm run lint && npm run test:run

# Full verification (required before PR)
npm run typecheck && npm run lint && npm run format && npm run test:run && npm run build && npm run size-limit
```

## Deployment

### Pre-Deployment Checklist

```bash
# 1. Verify all checks pass
npm run typecheck        # ✅ Zero TypeScript errors
npm run lint             # ✅ Zero lint errors
npm run test:run         # ✅ All tests passing
npm run build            # ✅ Build succeeds
npm run size-limit       # ✅ Bundle within limits

# 2. Test production build locally
npm run preview          # Visit http://localhost:4173

# 3. Create release PR
# Merge release/ branch to main
```

### Vercel (Recommended)

1. **Connect GitHub repo** to Vercel
2. **Set environment variables:**
   - `VITE_API_URL=https://api.stellar-oracle.example.com/api`
   - `VITE_WS_URL=wss://api.stellar-oracle.example.com`
3. **Deploy:** Vercel auto-deploys on `main` push

### Manual Build & Deploy

```bash
# Build production bundle
npm run build

# Outputs to dist/ folder
# Upload dist/ to any static host:
# - AWS S3 + CloudFront
# - Google Cloud Storage + CDN
# - Azure Static Web Apps
# - GitHub Pages
# - etc.

# Configure host to serve index.html for all 404 routes (SPA requirement)
```

## Contributing

### Getting Help

**Before contributing:**

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Review [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. Check [AGENTS.md](AGENTS.md) for code conventions
4. Search existing [Issues](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/issues)

### Ways to Contribute

- 🐛 **Bug fixes** — Found an issue? Open a GitHub issue
- ✨ **Features** — New functionality? Discuss in an issue first
- 📖 **Documentation** — Improve docs, README, or comments
- ⚡ **Performance** — Speed optimizations
- 🔒 **Security** — Report vulnerabilities privately
- ♿ **Accessibility** — Improve WCAG compliance
- 🧪 **Tests** — Improve test coverage

### Code Standards

**TypeScript:**
- ✅ Strict mode enabled
- ✅ No `any` type (use `unknown` with type guards)
- ✅ JSDoc for public APIs
- ✅ Meaningful variable names

**React:**
- ✅ Functional components only
- ✅ `memo()` for expensive renders
- ✅ Custom hooks for logic reuse
- ✅ Context for shared state

**Testing:**
- ✅ Unit tests for utils and hooks
- ✅ Component tests for UI logic
- ✅ E2E tests for workflows
- ✅ >80% coverage for new code

**Security:**
- ✅ Input validation (Zod)
- ✅ XSS prevention
- ✅ No secrets in code
- ✅ Safe storage practices

## Security

### XSS Prevention

✅ React auto-escaping  
✅ DOMPurify for HTML  
✅ Zod validation  
✅ CSP headers  
✅ No inline scripts  

See [XSS_AUDIT_REPORT.md](XSS_AUDIT_REPORT.md) for audit.

### Storage Security

✅ No secrets in localStorage  
✅ Centralized storage access  
✅ Session-only secrets  
✅ IndexedDB for sensitive data  

## Resources

### Documentation

- [README.md](README.md) — Project overview (this file)
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contributing guidelines
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design
- [docs/README.md](docs/README.md) — API documentation
- [AGENTS.md](AGENTS.md) — Code style guide
- [XSS_AUDIT_REPORT.md](XSS_AUDIT_REPORT.md) — Security audit

### External Links

- [React 19 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Vite Guide](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)

### Support

- **Issues:** https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/issues
- **Email:** support@stellar-oracle.example.com
- **Discord:** Join our community server

---

## Status

| Check | Status |
|-------|--------|
| **CI/CD** | [![CI](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/actions/workflows/ci.yml) |
| **TypeScript** | ✅ Strict mode |
| **Tests** | ✅ >80% coverage |
| **Security** | ✅ XSS audit passed |
| **Performance** | ✅ <200 kB bundles |
| **License** | MIT |

---

## Quick Reference

| Goal | Command |
|------|---------|
| Start developing | `npm run dev` |
| Run tests | `npm test` |
| Check types | `npm run typecheck` |
| Build for prod | `npm run build` |
| Create PR | See [Development Workflow](#development-workflow) |

**New here?** Start with [Quick Start](#quick-start) → [Prerequisites](#prerequisites) → [Setup](#setup--installation)

**Ready to code?** See [Development Workflow](#development-workflow)

**Contributing?** Check [Contributing](#contributing)

---

**Last Updated:** 2026-08-26  
**Version:** 1.0.0  
**Status:** Production Ready ✅
