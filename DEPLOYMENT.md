# Deployment Guide — Stellar Unified Price Oracle Frontend

## Table of Contents

1. [Prerequisites and Environment Requirements](#1-prerequisites-and-environment-requirements)
2. [Staging Environment](#2-staging-environment)
3. [Build Configuration for Different Environments](#3-build-configuration-for-different-environments)
4. [Vercel Deployment Steps](#4-vercel-deployment-steps)
5. [Environment Variable Reference](#5-environment-variable-reference)
6. [Custom Domain Setup](#6-custom-domain-setup)
7. [SSL/HTTPS Configuration](#7-sslhttps-configuration)
8. [Monitoring and Alerting Setup](#8-monitoring-and-alerting-setup)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Performance Tuning Guide](#10-performance-tuning-guide)

---

## 1. Prerequisites and Environment Requirements

### Runtime Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 20.x LTS | 22.x LTS |
| npm | 10.x | 10.x |
| Git | 2.x | latest |

### System Dependencies

```bash
# Verify Node.js version
node --version   # must be >= 20.0.0

# Verify npm version
npm --version    # must be >= 10.0.0
```

### Environment File

Copy the example environment file and populate it with real values before building:

```bash
cp .env.example .env
```

Ensure the following variables are set (see [§5 Environment Variable Reference](#5-environment-variable-reference) for full details):

- `VITE_API_URL` — REST API base URL
- `VITE_WS_URL` — WebSocket endpoint

### Backend Dependency

This frontend consumes the [Stellar Unified Price Oracle Aggregator API](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Aggregator-API). The backend must be reachable at the URLs configured in `VITE_API_URL` and `VITE_WS_URL`.

---

## 2. Staging Environment

### Overview

A staging environment provides a production-like validation layer before code reaches live users. It:

- **Deploys automatically** after successful CI tests on the `main` branch
- **Uses test API endpoints** to avoid affecting production data
- **Protected by basic auth** to restrict access to authorized users
- **Runs full E2E test suite** before production promotion
- **Provides a manual promotion workflow** with approval gates

### Quick Start

To set up a staging environment:

1. **Create a staging project** in your hosting platform (e.g., Vercel):
   ```bash
   vercel projects add stellar-oracle-frontend-staging
   ```

2. **Add GitHub repository secrets** for staging credentials:
   - `VERCEL_STAGING_PROJECT_ID` — Vercel staging project ID
   - `STAGING_API_URL` — Staging API base URL
   - `STAGING_WS_URL` — Staging WebSocket URL
   - `STAGING_BASIC_AUTH_USER` — Basic auth username
   - `STAGING_BASIC_AUTH_PASS` — Basic auth password

3. **Generate and configure basic auth**:
   ```bash
   ./scripts/setup-staging-auth.sh
   ```

4. **Verify staging security**:
   ```bash
   ./scripts/verify-staging-security.sh --user <username> --pass <password>
   ```

### Automatic Deployments

On every push to `main`:

1. CI pipeline runs all checks (typecheck, lint, build, unit tests, E2E tests)
2. If all checks pass, the `deploy-staging` job runs
3. Frontend is built with staging API endpoints
4. Deployed to Vercel staging project
5. GitHub deployment status is created

### Manual Promotion to Production

When ready to go live:

1. Go to **Actions** → **Promote to Production**
2. Click **Run workflow**
3. Select staging commit (default: latest main)
4. Choose whether to run E2E tests
5. Wait for approval gate
6. Once approved, production deployment begins
7. Post-deployment smoke tests verify the deploy

For details, see [docs/STAGING_DEPLOYMENT.md](./docs/STAGING_DEPLOYMENT.md).

---

## 3. Build Configuration for Different Environments

### Development

```bash
npm install
cp .env.example .env   # edit values as needed
npm run dev            # Vite dev server at http://localhost:5173
```

The dev server automatically proxies `/api` and `/ws` requests to the backend using the `VITE_PROXY_API` and `VITE_PROXY_WS` env vars (or falls back to `VITE_API_URL` / `VITE_WS_URL`).

### Staging

Create a `.env.staging` file:

```env
VITE_API_URL=https://api.staging.example.com/api
VITE_WS_URL=wss://api.staging.example.com
```

Build against staging:

```bash
cp .env.staging .env
npm run build
```

The build output lands in `dist/`. Upload it to your staging static host.

### Production

Create a `.env.production` file (never commit this):

```env
VITE_API_URL=https://api.example.com/api
VITE_WS_URL=wss://api.example.com
```

Build for production:

```bash
cp .env.production .env
npm ci          # clean install from lockfile
npm run build   # type-checks then bundles to dist/
```

#### Bundle Size Validation

After building, verify bundle size budgets are met:

```bash
npm run size-limit
```

| Asset | Budget |
|-------|--------|
| JS entry chunk | 200 kB (brotli) |
| Total JS | 600 kB (brotli) |
| CSS bundle | 50 kB (brotli) |

The CI pipeline enforces these budgets on every push to `main`.

#### Bundle Analysis

Generate an interactive treemap to inspect what is in the bundle:

```bash
npm run build:analyze
# Opens reports/bundle-analysis.html in the browser
```

---

## 4. Vercel Deployment Steps

### First-Time Setup

1. **Install the Vercel CLI** (or connect via the Vercel dashboard):

   ```bash
   npm install -g vercel
   ```

2. **Authenticate:**

   ```bash
   vercel login
   ```

3. **Link the project** (run once from the repo root):

   ```bash
   vercel link
   ```

   - Select your Vercel scope/team.
   - Create a new project or link to an existing one.
   - The framework preset will be detected as **Vite** automatically.

### Environment Variables in Vercel

Set production environment variables via the Vercel dashboard or CLI **before** the first production deploy:

```bash
vercel env add VITE_API_URL production
vercel env add VITE_WS_URL production
```

These are injected at build time (Vite bakes them into the bundle). Any change to `VITE_*` variables requires a redeploy.

### Deploy to Production

```bash
vercel --prod
```

Vercel runs `npm ci && npm run build` on its build servers and publishes `dist/`.

### Deploy a Preview (Staging/PR)

```bash
vercel              # deploys to a unique preview URL
```

Preview deployments are created automatically for every pull request when the GitHub integration is enabled.

### `vercel.json` Configuration

The repo ships with [`vercel.json`](vercel.json) that configures the build and SPA routing:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "devCommand": "npm run dev"
}
```

Add a `rewrites` rule to support client-side routing:

```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

### Netlify Alternative

A `netlify.toml` equivalent configuration:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Deploy with:

```bash
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

---

## 5. Environment Variable Reference

All variables are prefixed with `VITE_` so Vite bakes them into the client bundle at build time. Never put secrets in these variables — they are visible in the shipped JavaScript.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | `/api` | Base URL for the REST API. In production use an absolute URL (e.g. `https://api.example.com/api`). |
| `VITE_WS_URL` | Yes | `ws://localhost:3000` | WebSocket endpoint URL. Use `wss://` in production. |
| `VITE_PROXY_API` | No | — | Dev-only. Overrides the `/api` proxy target. Accepts a URL string or a JSON `ProxyOptions` object. |
| `VITE_PROXY_WS` | No | — | Dev-only. Overrides the `/ws` proxy target. |

### Example `.env.example`

```env
VITE_API_URL=/api
VITE_WS_URL=ws://localhost:3000
```

### Validation

Environment variables are validated at app startup in `src/config/validateEnv.ts`. Missing required variables cause a visible error in development and are logged as warnings in production.

---

## 6. Custom Domain Setup

### Vercel

1. Open the Vercel project dashboard → **Settings** → **Domains**.
2. Click **Add** and enter your domain (e.g. `oracle.example.com`).
3. Follow the DNS instructions shown:
   - For an apex domain (`example.com`): add an `A` record pointing to `76.76.21.21`.
   - For a subdomain (`oracle.example.com`): add a `CNAME` record pointing to `cname.vercel-dns.com`.
4. Wait for DNS propagation (typically < 5 minutes for subdomain, up to 48 hours for apex).
5. Vercel automatically provisions and renews a TLS certificate via Let's Encrypt once DNS resolves.

### Netlify

1. Open the Netlify site dashboard → **Domain management** → **Add custom domain**.
2. Enter your domain and follow the DNS instructions (similar `A`/`CNAME` steps as above).
3. Netlify provisions a Let's Encrypt certificate automatically.

### Generic Static Host

1. Build the project: `npm run build`.
2. Upload the `dist/` directory to your static host (S3, GCS, Cloudflare Pages, etc.).
3. Configure your host to serve `index.html` for all unmatched routes (needed for client-side routing).
4. Point your domain's DNS to the host's IP or CNAME target.

---

## 7. SSL/HTTPS Configuration

### Automatic Certificate Provisioning (Vercel / Netlify)

Both Vercel and Netlify provision and auto-renew TLS certificates from Let's Encrypt. No manual action is needed after domain verification.

### Enforcing HTTPS

- **Vercel**: HTTPS redirect is enabled by default. All HTTP requests are permanently redirected (301) to the HTTPS equivalent.
- **Netlify**: Add the following to `netlify.toml` to force HTTPS:

  ```toml
  [[headers]]
    for = "/*"
    [headers.values]
      Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
  ```

### WebSocket Security (`wss://`)

Production deployments must use `wss://` (WebSocket Secure) for `VITE_WS_URL`. Browsers block `ws://` connections from HTTPS origins. Example:

```env
VITE_WS_URL=wss://api.example.com
```

### Content Security Policy (CSP)

To restrict resource origins, add CSP headers on your hosting platform. An example policy for this application:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.example.com wss://api.example.com;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
```

Adjust `connect-src` to match your `VITE_API_URL` and `VITE_WS_URL` origins.

---

## 8. Monitoring and Alerting Setup

### Web Vitals (Built-in)

The app reports Core Web Vitals (CLS, FCP, LCP, TTFB, INP) via `web-vitals`. The `useWebVitals` hook in `src/hooks/useWebVitals.ts` collects these metrics. Wire up a reporting endpoint:

```typescript
// src/hooks/useWebVitals.ts — extend the onReport callback
onReport: (metric) => {
  fetch('/api/metrics/web-vitals', {
    method: 'POST',
    body: JSON.stringify(metric),
  })
}
```

### Error Monitoring

The `ErrorReporterContext` in `src/context/ErrorReporterContext.tsx` provides a central hook for reporting errors. Connect it to an external service by implementing the reporter interface:

```typescript
// src/context/ErrorReporterContext.tsx
// Plug in Sentry, Datadog, or a custom endpoint:
import * as Sentry from '@sentry/react'

Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })

const reporter: ErrorReporter = {
  report: (error, context) => Sentry.captureException(error, { extra: context }),
}
```

Add `VITE_SENTRY_DSN` to your environment variables if using Sentry.

### Uptime Monitoring

Use an external uptime service (e.g., UptimeRobot, Betterstack, Checkly) to monitor:

| Check | URL | Expected Status |
|-------|-----|-----------------|
| App availability | `https://oracle.example.com` | 200 |
| API health | `https://api.example.com/health` | 200 |

Set alerts to notify your team via Slack, email, or PagerDuty when any check fails for > 2 consecutive minutes.

### CI / Build Alerts

The GitHub Actions workflow (`.github/workflows/ci.yml`) sends build and test failure notifications to GitHub's native notification system. For Slack alerts, add the following to the workflow:

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v2
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      { "text": "❌ CI failed on ${{ github.ref }} — ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" }
```

---

## 9. Rollback Procedure

### Vercel Rollback

Vercel keeps all previous deployments permanently. Roll back instantly via the dashboard:

1. Open the Vercel project → **Deployments** tab.
2. Find the last known-good deployment.
3. Click the **⋯ menu** → **Promote to Production**.

Or use the CLI:

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```

### Netlify Rollback

1. Open the Netlify site → **Deploys** tab.
2. Click the target deploy → **Publish deploy**.

### Git-Based Rollback

If a bad commit was deployed, revert it and redeploy:

```bash
# Identify the last good commit
git log --oneline

# Revert the bad commit (creates a new revert commit — safe for shared branches)
git revert <bad-commit-sha>
git push origin main
```

The CI pipeline will trigger automatically and deploy the reverted code.

For an emergency that cannot wait for CI, cherry-pick and force-push to the deployment branch (use with caution):

```bash
git checkout main
git revert HEAD --no-edit
git push origin main
```

### Bundle-Level Rollback

If the issue is an oversized bundle (failing `size-limit`), roll back the dependency change:

```bash
# Restore the previous package-lock.json
git checkout <last-good-sha> -- package-lock.json
npm ci
npm run build
```

---

## 10. Performance Tuning Guide

### Code Splitting

Vite automatically code-splits at dynamic `import()` boundaries. Lazy-load routes that are not critical to the initial render:

```typescript
// src/App.tsx — lazy-load non-critical pages
const ApiDocs = React.lazy(() => import('./pages/ApiDocs'))
const PriceDetail = React.lazy(() => import('./pages/PriceDetail'))
```

### Manual Chunk Strategy

Large vendor libraries are split into named chunks in `vite.config.ts`:

```typescript
manualChunks: {
  'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
  'vendor-recharts': ['recharts'],
  'vendor-utils':    ['zod'],
}
```

Add new heavy dependencies to a named chunk rather than letting them inflate the entry bundle.

### Web Workers

Heavy computation (data parsing, export generation, chart aggregation) is offloaded to Web Workers via Comlink. See `src/workers/` for the worker pool implementation. This keeps the main thread responsive during large data operations.

### Asset Optimisation

- **Images**: Convert images to WebP/AVIF and serve via a CDN.
- **Fonts**: Self-host fonts and use `font-display: swap` to avoid FOUT.
- **Preconnect hints**: The build system automatically injects `<link rel="preconnect">` hints for the API and WebSocket origins.

### Caching Strategy

Configure your CDN or static host to set long-lived cache headers on hashed assets:

```
# All files in /assets/ are content-addressed (hash in filename)
Cache-Control: public, max-age=31536000, immutable

# HTML entry point must always be revalidated
Cache-Control: no-cache, must-revalidate
```

On Vercel/Netlify, this is handled automatically for Vite builds.

### Bundle Size Budget Enforcement

The `size-limit` configuration in `package.json` enforces size budgets in CI. If a budget is exceeded:

1. Run `npm run build:analyze` to identify what grew.
2. Check if a dependency was added or updated without a code-split.
3. Move the heavy import behind a dynamic `import()` or add it to a named `manualChunks` entry.
4. Re-run `npm run size-limit` locally before pushing.

### WebSocket Optimisation

The WebSocket client in `src/api/websocket.ts` implements:

- **Auto-reconnect** with exponential backoff — avoids hammering the server after a disconnect.
- **Optimistic updates** — price changes appear in the UI immediately, then confirmed/rolled back after the REST poll, eliminating perceived latency.

Tune the reconnect parameters (`BASE_DELAY_MS`, `MAX_DELAY_MS`) in the client if the backend has a lower connection rate limit.
