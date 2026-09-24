# Staging Deployment Guide

This guide covers setting up and managing the staging environment for the Stellar Unified Price Oracle Frontend.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Initial Setup](#initial-setup)
4. [Automatic Deployments](#automatic-deployments)
5. [Manual Deployment](#manual-deployment)
6. [Access Control & Security](#access-control--security)
7. [Testing in Staging](#testing-in-staging)
8. [Monitoring & Logs](#monitoring--logs)
9. [Troubleshooting](#troubleshooting)
10. [Promotion to Production](#promotion-to-production)

---

## Overview

The staging environment serves as a production-like validation layer before code reaches live users. It:

- **Deploys automatically** after successful CI tests on the `main` branch
- **Uses test API endpoints** to avoid affecting production data
- **Gated by basic auth** to restrict access to authorized users
- **Runs full E2E test suite** before production promotion
- **Provides a manual promotion workflow** with approval gates

## Architecture

```
main branch push
       │
       ├─→ [CI Pipeline]
       │    └─→ typecheck, lint, build, unit tests
       │         └─→ E2E tests (chromium, firefox, webkit)
       │              └─→ Visual regression tests
       │                   └─→ Bundle size analysis
       │
       └─→ [Automatic Staging Deploy]
            ├─→ Build with STAGING_API_URL / STAGING_WS_URL
            ├─→ Deploy to Vercel staging project
            ├─→ Basic auth protection enabled
            └─→ Ready for manual promotion to production
```

Promotion flow:

```
Staging Environment
       │
       ├─→ [Manual Workflow Trigger]
       │    └─→ Validate staging commit
       │         └─→ Optional: Run E2E tests against staging
       │              └─→ [Manual Approval Gate]
       │                   └─→ [Production Deployment]
       │                        └─→ [Post-deployment Smoke Tests]
       │                             └─→ [Automatic Rollback on Failure]
       │
       └─→ Production Environment (live users)
```

## Initial Setup

### Prerequisites

- GitHub repository with admin or maintainer access
- Vercel account with two projects: one for staging, one for production
- Backend staging and production API endpoints
- Basic auth credentials (username/password) for staging access

### 1. Create Vercel Projects

Create two separate Vercel projects:

```bash
# Staging project
vercel projects add stellar-oracle-frontend-staging

# Production project
vercel projects add stellar-oracle-frontend-production
```

### 2. Configure GitHub Repository Secrets

Add the following secrets in **Settings → Secrets and variables → Actions**:

#### Vercel credentials (shared)
```
VERCEL_TOKEN          # Personal access token from Vercel
VERCEL_ORG_ID         # Vercel organization/team ID
```

#### Staging environment
```
VERCEL_STAGING_PROJECT_ID    # Project ID for staging (from vercel projects list)
STAGING_API_URL              # e.g., https://staging-api.example.com/api
STAGING_WS_URL               # e.g., wss://staging-api.example.com
STAGING_BASIC_AUTH_USER      # Basic auth username for staging
STAGING_BASIC_AUTH_PASS      # Basic auth password for staging
```

#### Production environment
```
VERCEL_PRODUCTION_PROJECT_ID  # Project ID for production
PRODUCTION_API_URL            # e.g., https://api.example.com/api
PRODUCTION_WS_URL             # e.g., wss://api.example.com
```

#### Optional: Error tracking
```
SENTRY_AUTH_TOKEN   # For uploading source maps
SENTRY_ORG         # Sentry organization
SENTRY_PROJECT     # Sentry project ID
```

### 3. Link Projects in Vercel Dashboard

For each project (staging and production):

1. Open the Vercel project → **Settings**
2. Go to **Environment Variables**
3. Add the same `VITE_API_URL` and `VITE_WS_URL` used in the GitHub secrets

### 4. Enable GitHub Deployments

In Vercel project settings → **Integrations** → **GitHub**, ensure the integration is connected and set to auto-deploy from `main` branch.

### 5. Configure Basic Auth (Staging Only)

In Vercel staging project → **Settings** → **Protected Paths**:

1. Enable "Require authentication"
2. Add basic auth credential pairs
3. Apply to all routes except `/health` and `/api/*`

Alternatively, use `vercel.json` to configure basic auth via middleware:

```json
{
  "middleware": [
    {
      "src": "/(.*)",
      "dest": "/$1",
      "methods": ["GET", "HEAD"],
      "headers": {
        "x-middleware-request-authorization": "${{ secrets.STAGING_BASIC_AUTH_USER }}:${{ secrets.STAGING_BASIC_AUTH_PASS }}"
      }
    }
  ]
}
```

## Automatic Deployments

### How It Works

1. A commit is pushed to `main`
2. CI pipeline runs all checks (typecheck, lint, build, tests)
3. If all checks pass:
   - The `deploy-staging` job runs
   - Builds the frontend with staging API endpoints
   - Deploys to the Vercel staging project
   - Creates a GitHub deployment record
4. Staging is updated and ready for testing

### View Deployment Status

In GitHub:

1. Go to **Actions** → **CI** workflow
2. Click the latest run for `main`
3. Scroll to **deploy-staging** job
4. Check the logs for deployment details

In Vercel:

1. Open the staging project dashboard
2. Go to **Deployments**
3. Find the commit hash from the GitHub run
4. Click to view deployment details

### Rollback Staging

If a bad deployment reaches staging:

**Via Vercel:**
```bash
# List deployments
vercel ls

# Promote a previous deployment
vercel promote <deployment-url>
```

**Via git:**
```bash
# Revert the offending commit
git revert <bad-commit-sha>
git push origin main

# CI will re-run and deploy the revert
```

## Manual Deployment

If you need to bypass automatic deployments (e.g., hotfix):

```bash
# Build for staging
VITE_API_URL=https://staging-api.example.com/api \
VITE_WS_URL=wss://staging-api.example.com \
npm run build

# Deploy
vercel deploy --prod \
  --token=$VERCEL_TOKEN \
  --build-env VITE_API_URL=https://staging-api.example.com/api \
  --build-env VITE_WS_URL=wss://staging-api.example.com
```

## Access Control & Security

### Basic Auth for Staging

Staging is protected with basic auth to prevent accidental indexing by search engines and unauthorized access.

**Credentials stored in:**
- GitHub repository secrets (`STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASS`)
- Vercel project environment variables
- Shared with authorized team members via 1Password or similar

**Access URLs:**
- Staging app: `https://staging.example.com`
- When prompted, enter the basic auth credentials

### IP Whitelist (Optional)

For additional security, configure IP whitelisting in Vercel or use a WAF:

1. Vercel → Project → **Settings** → **IP Whitelist**
2. Add office/VPN IP ranges
3. Allow GitHub Actions runner IPs for CI deployments

### Secrets Management

**Never commit secrets in code:**
- ✅ Use GitHub repository secrets for environment variables
- ✅ Use Vercel environment variables for deployment-time secrets
- ❌ Don't commit `.env.production` or `.env.staging` with real values
- ❌ Don't log or share basic auth credentials in chat

## Testing in Staging

### Automated Tests (CI Pipeline)

The CI pipeline automatically runs before staging deployment:

- **Unit tests** — `npm run test:run`
- **E2E tests** — `npm run test:e2e` (chromium, firefox, webkit)
- **Visual regression** — screenshot comparisons
- **Bundle size** — enforce budget limits

### Manual E2E Testing

Run E2E tests against the live staging environment:

```bash
# Connect to staging
VITE_API_URL=https://staging-api.example.com/api \
VITE_WS_URL=wss://staging-api.example.com \
npm run test:e2e

# Run specific test
npm run test:e2e -- --grep "Price Feed"
```

### Manual Smoke Tests

Quick sanity checks for your staging environment:

```bash
# Check app loads
curl -u user:pass https://staging.example.com/ | grep -i stellar

# Check API connection
curl -u user:pass https://staging.example.com/api/health

# Check WebSocket endpoint
wscat -c wss://staging-api.example.com --header "Authorization: Basic $(echo -n 'user:pass' | base64)"
```

### Browser Testing

1. Navigate to `https://staging.example.com`
2. When prompted, enter basic auth credentials
3. Verify:
   - App loads without errors
   - Price feed updates in real-time
   - API endpoints respond correctly
   - WebSocket connection is active

## Monitoring & Logs

### GitHub Actions Logs

View deployment logs in the CI workflow:

1. **Actions** → **CI**
2. Click the latest run
3. Expand **deploy-staging** job
4. Check build and deployment logs

### Vercel Logs

View function and deployment logs:

1. Open Vercel project → **Logs**
2. Filter by environment or time range
3. Watch for errors or slowdowns

### Error Tracking

If Sentry is configured, check **Sentry dashboard** for:
- Runtime errors in staging
- Performance issues
- User session replays

### Uptime Monitoring

Monitor staging availability with an external service:

```bash
# Uptime check endpoint
https://staging.example.com/health

# Expected response
{ "status": "ok" }
```

## Troubleshooting

### Staging deployment failed

1. Check GitHub Actions workflow logs:
   ```
   Actions → CI → deploy-staging job
   ```
2. Check Vercel build logs:
   ```
   Vercel project → Deployments → Click failed deploy
   ```
3. Common issues:
   - Missing environment variables — add to GitHub secrets
   - API endpoint unreachable — verify `STAGING_API_URL` is correct
   - Build command failed — check `npm run build` locally with staging env vars

### Can't access staging (401 Unauthorized)

1. Verify basic auth credentials are correct
2. Check credentials are set in Vercel project settings
3. Verify credentials match GitHub secrets:
   ```bash
   # Decode basic auth from Vercel logs
   echo "Authorization: Basic <header>" | base64 -d
   ```

### E2E tests fail against staging

1. Ensure test API is running and reachable
2. Check if `STAGING_API_URL` and `STAGING_WS_URL` are correct
3. Run tests locally with staging URLs:
   ```bash
   VITE_API_URL=https://staging-api.example.com/api \
   VITE_WS_URL=wss://staging-api.example.com \
   npm run test:e2e
   ```

### Price data not updating in staging

1. Check WebSocket connection:
   ```bash
   curl -u user:pass https://staging.example.com/
   # Look for WebSocket errors in browser console
   ```
2. Verify staging API endpoint is healthy:
   ```bash
   curl https://staging-api.example.com/health
   ```
3. Check if test data is flowing through the API

### Bundle size exceeds limits

1. Check what changed in the build:
   ```bash
   npm run build:analyze
   ```
2. If a dependency was added, consider:
   - Code splitting with dynamic `import()`
   - Moving to `devDependencies` if not needed at runtime
   - Finding a lighter alternative

## Promotion to Production

See [Production Promotion](./docs/PRODUCTION_PROMOTION.md) for detailed promotion workflow.

### Quick Promotion Checklist

Before promoting staging to production:

- [ ] All CI checks pass (typecheck, lint, build, tests)
- [ ] E2E tests pass against staging environment
- [ ] Visual regression tests reviewed and approved
- [ ] Bundle size within limits
- [ ] No critical security warnings (`npm audit`)
- [ ] API endpoint health verified
- [ ] Team approval obtained (via GitHub environment)
- [ ] Rollback plan confirmed

### Promote via GitHub Actions

1. Go to **Actions** → **Promote to Production**
2. Click **Run workflow**
3. Select the staging commit (default: latest main)
4. Choose whether to run E2E tests (recommended)
5. Wait for approval gate
6. Once approved, production deployment begins
7. Monitor smoke tests and post-deployment health

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — General deployment guide
- [docs/PRODUCTION_PROMOTION.md](./docs/PRODUCTION_PROMOTION.md) — Production promotion workflow
- [CI Workflow](./.github/workflows/ci.yml) — Automated build and test pipeline
- [Promote Workflow](./.github/workflows/promote-to-production.yml) — Gated promotion to production
