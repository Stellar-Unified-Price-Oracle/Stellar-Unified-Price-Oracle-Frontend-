# Staging Environment Setup — Complete Guide

This document provides an overview of the staging environment implementation for the Stellar Unified Price Oracle Frontend.

## 🎯 Problem Solved

**Before:** Code changes went directly from development branches to production without intermediate validation. This created risk.

**After:** A complete staging pipeline with:
- ✅ Automatic staging deployment after CI passes
- ✅ Production-like staging environment with test API endpoints
- ✅ Full E2E test suite execution before production
- ✅ Basic auth access control for staging
- ✅ Manual gated promotion from staging to production
- ✅ Post-deployment smoke tests and automatic rollback

## 📋 Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Enhanced CI with automatic staging deployment |
| `.github/workflows/promote-to-production.yml` | Manual gated promotion workflow |
| `.env.staging` | Staging environment configuration template |
| `.env.production` | Production environment configuration template |
| `vercel.json` | Vercel deployment configuration |
| `scripts/setup-staging-auth.sh` | Generate and configure basic auth credentials |
| `scripts/verify-staging-security.sh` | Verify staging security configuration |
| `docs/STAGING_DEPLOYMENT.md` | Comprehensive staging deployment guide |
| `docs/STAGING_SETUP_CHECKLIST.md` | Quick reference setup checklist |
| `docs/PRODUCTION_PROMOTION.md` | Production promotion workflow guide |
| `DEPLOYMENT.md` | Updated with staging section |

### Architecture

```
Development
    ↓ (git push main)
CI Pipeline
    ├─ typecheck
    ├─ lint
    ├─ build
    ├─ unit tests
    ├─ E2E tests (chromium, firefox, webkit)
    ├─ visual regression tests
    ├─ bundle size analysis
    └─ [All pass?]
         ↓ YES
Automatic Staging Deploy
    ├─ Build with STAGING_API_URL / STAGING_WS_URL
    ├─ Deploy to Vercel staging project
    ├─ Enable basic auth protection
    └─ Ready for testing
         ↓ [QA tests staging]
Manual Promotion Workflow
    ├─ Validate staging commit
    ├─ Optional E2E tests against staging
    ├─ Approval gate (manual review)
    ├─ Build with PRODUCTION_API_URL / PRODUCTION_WS_URL
    ├─ Deploy to Vercel production project
    ├─ Post-deployment smoke tests
    └─ [Automatic rollback on failure]
         ↓ SUCCESS
Production Live
```

## 🚀 Quick Start

### For First-Time Setup

1. **Follow the setup checklist:**
   ```bash
   cat docs/STAGING_SETUP_CHECKLIST.md
   ```

2. **Configure GitHub secrets and environment variables** (10 minutes)

3. **Generate staging credentials:**
   ```bash
   ./scripts/setup-staging-auth.sh
   ```

4. **Verify staging configuration:**
   ```bash
   ./scripts/verify-staging-security.sh
   ```

### For Daily Operations

**Deploy to staging (automatic):**
- Just push to `main` — CI runs and staging auto-deploys

**Promote to production (manual):**
1. Go to **Actions** → **Promote to Production**
2. Click **Run workflow**
3. Wait for approval gate
4. Click **Review deployments** and **Approve and deploy**

## 📚 Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [docs/STAGING_SETUP_CHECKLIST.md](./docs/STAGING_SETUP_CHECKLIST.md) | Quick reference with all setup steps | DevOps / Platform Engineers |
| [docs/STAGING_DEPLOYMENT.md](./docs/STAGING_DEPLOYMENT.md) | Comprehensive staging operations guide | All developers |
| [docs/PRODUCTION_PROMOTION.md](./docs/PRODUCTION_PROMOTION.md) | How to promote to production | All developers |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | General deployment reference (updated) | All developers |

## 🔒 Security Features

- **Basic Auth:** Staging is protected with username/password
- **API Segregation:** Staging uses test API endpoints (never production data)
- **Environment Separation:** Staging and production secrets are isolated
- **Approval Gates:** Manual review required before production deployment
- **Audit Trail:** All deployments are recorded in GitHub
- **Automatic Rollback:** Failed deployments automatically roll back

## ⚙️ Configuration

### Environment Variables Required

Set these in GitHub **Settings → Secrets and variables → Actions**:

```
# Vercel credentials (shared)
VERCEL_TOKEN              # Personal access token
VERCEL_ORG_ID             # Organization/team ID

# Staging
VERCEL_STAGING_PROJECT_ID
STAGING_API_URL           # e.g., https://staging-api.example.com/api
STAGING_WS_URL            # e.g., wss://staging-api.example.com
STAGING_BASIC_AUTH_USER
STAGING_BASIC_AUTH_PASS

# Production
VERCEL_PRODUCTION_PROJECT_ID
PRODUCTION_API_URL        # e.g., https://api.example.com/api
PRODUCTION_WS_URL         # e.g., wss://api.example.com

# Optional
SENTRY_AUTH_TOKEN         # For source map uploads
SENTRY_ORG
SENTRY_PROJECT
```

### CI/CD Jobs

#### Automatic on every `main` push:
1. **frontend** — Typecheck, lint, build, unit tests
2. **e2e** — E2E tests (chromium, firefox, webkit)
3. **visual-regression** — Screenshot comparison
4. **bundle-analysis** — Size budget enforcement
5. **api-version-check** — Backend compatibility check
6. **deploy-staging** — Build and deploy to staging (if all pass)

#### Manual workflow:
1. **Promote to Production** — Gated production deployment

## 📊 Workflow Stages

### Automatic Staging Deployment

```
Push to main
    ↓
[CI checks: typecheck, lint, build, tests]
    ↓ All pass?
    ├─ YES → [Build with staging config]
    │          ↓
    │        [Deploy to Vercel staging]
    │          ↓
    │        [Create GitHub deployment]
    │          ↓
    │        Staging ready ✓
    │
    └─ NO → Build fails, staging not updated
```

### Manual Production Promotion

```
Trigger "Promote to Production" workflow
    ↓
[Validate staging commit]
    ↓
[Optional: Run E2E tests against staging]
    ↓ Tests pass (or skipped)
    ↓
[Approval gate]
    ├─ Waiting for review...
    └─ Once approved:
        ↓
        [Build with production config]
        ↓
        [Deploy to Vercel production]
        ↓
        [Run smoke tests]
        ├─ PASS → Live in production ✓
        └─ FAIL → Automatic rollback, alert team
```

## 🔍 Monitoring & Logs

### View CI Pipeline Logs
```bash
gh workflow view CI
gh workflow run -n ci | head -1 | xargs gh run view
```

### View Promotion Workflow Logs
```bash
gh workflow view "Promote to Production"
```

### View Deployments
```bash
gh deployment list --prod
```

### Check Vercel Deployments
```bash
vercel ls --prod  # Production deployments
vercel ls         # Staging deployments
```

## 🆘 Troubleshooting

### Staging deployment not happening
1. Check CI passes: **Actions → CI** (latest run)
2. Check secrets are set: `gh secret list`
3. Check Vercel project ID is correct: `vercel projects list`

### Can't access staging
1. Check basic auth credentials: `gh secret list | grep STAGING_BASIC_AUTH`
2. Verify Vercel has basic auth enabled
3. Run verification: `./scripts/verify-staging-security.sh`

### Production promotion fails
1. Check staging commit exists: `git log --oneline main`
2. Run validation: **Actions → Promote to Production → Review logs**
3. Verify production secrets: `gh secret list | grep PRODUCTION`

For detailed troubleshooting, see [docs/STAGING_DEPLOYMENT.md](./docs/STAGING_DEPLOYMENT.md).

## 📈 Best Practices

### Before Pushing
- [ ] Code review completed
- [ ] All tests pass locally: `npm run test:run`
- [ ] Build succeeds: `npm run build`

### During Staging
- [ ] Test in staging environment
- [ ] Verify all features work
- [ ] Check for console errors

### Before Production
- [ ] Staging tested and approved
- [ ] No breaking changes
- [ ] Have rollback plan ready
- [ ] Communicate with team

### After Production
- [ ] Monitor health metrics
- [ ] Check Sentry for errors
- [ ] Verify uptime monitoring alerts
- [ ] Communicate success to team

## 🚨 Emergency Procedures

### Emergency Rollback
```bash
# List recent production deployments
vercel ls --prod

# Promote previous version
vercel promote <deployment-url>
```

### Revert Problematic Commit
```bash
# Revert and push new commit
git revert <bad-commit-sha>
git push origin main

# CI runs and deploys revert to staging
# Then promote to production normally
```

### Hotfix Process
1. Create hotfix branch: `git checkout -b hotfix/issue-name`
2. Implement fix
3. Push to branch for CI validation
4. Once working, merge to `main`
5. Follow normal promotion workflow

## 📞 Support

For questions or issues:

1. **Check documentation:** [docs/](./docs/)
2. **Review existing issues:** `gh issue list --state all`
3. **Check CI logs:** **Actions** tab in GitHub
4. **Run verification scripts:** `./scripts/verify-staging-security.sh`

## ✨ Key Improvements

| Before | After |
|--------|-------|
| Direct prod deploy from dev | Staged deployment with testing |
| No intermediate validation | Full E2E suite runs on staging |
| Anyone can deploy | Manual approval gate for production |
| No access control | Basic auth on staging |
| Manual rollback process | Automatic rollback on failed tests |
| No audit trail | Complete deployment history in GitHub |

## 🎓 Learning Resources

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Vercel deployments guide](https://vercel.com/docs/concepts/deployments/overview)
- [CI/CD best practices](https://martinfowler.com/articles/continuousIntegration.html)

---

**Last Updated:** 2026-08-25  
**Status:** ✅ Production Ready  
**Maintained by:** Platform Engineering
