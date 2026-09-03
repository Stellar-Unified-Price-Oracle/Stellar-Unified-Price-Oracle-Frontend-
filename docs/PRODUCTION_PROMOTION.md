# Production Promotion Workflow

This guide explains how to promote code from staging to production using the gated approval workflow.

## Overview

The staging-to-production promotion workflow ensures that code changes go through a defined validation process before reaching live users:

1. **Validation** — Verify the staging commit is valid
2. **Optional Testing** — Run E2E tests against staging (default: enabled)
3. **Approval Gate** — Require manual approval from authorized reviewers
4. **Deployment** — Deploy to production when approved
5. **Smoke Tests** — Run quick health checks post-deployment
6. **Rollback** — Automatic rollback if smoke tests fail

## Prerequisites

Before you can use the promotion workflow, ensure:

- [ ] Vercel staging and production projects are created
- [ ] GitHub repository secrets are configured:
  - `VERCEL_TOKEN` — Personal access token from Vercel
  - `VERCEL_ORG_ID` — Vercel organization ID
  - `VERCEL_STAGING_PROJECT_ID` — Staging project ID
  - `VERCEL_PRODUCTION_PROJECT_ID` — Production project ID
  - `STAGING_API_URL` — Staging API endpoint
  - `STAGING_WS_URL` — Staging WebSocket endpoint
  - `PRODUCTION_API_URL` — Production API endpoint
  - `PRODUCTION_WS_URL` — Production WebSocket endpoint
- [ ] GitHub environment protection rules are configured for `production-promotion` and `production` environments
- [ ] At least one reviewer is required to approve promotions

## Triggering a Promotion

### Via GitHub Actions UI

1. Go to your repository
2. Navigate to **Actions** → **Promote to Production**
3. Click **Run workflow** (top right)
4. Inputs appear:
   - **staging_version** — Commit SHA or "latest" (default: "latest")
   - **run_e2e_tests** — Whether to run E2E tests (default: true)
5. Click **Run workflow**

### Via GitHub CLI

```bash
# Promote latest main commit
gh workflow run promote-to-production.yml --ref main

# Promote a specific commit
gh workflow run promote-to-production.yml \
  --ref main \
  -f staging_version=abc123def456

# Skip E2E tests (for hotfixes)
gh workflow run promote-to-production.yml \
  --ref main \
  -f run_e2e_tests=false
```

## Workflow Stages

### 1. Validation (validate-staging)

**Purpose:** Ensure the staging commit exists and is valid.

**What happens:**
- Resolves the staging version (commit SHA or "latest")
- Verifies the commit exists in the main branch
- Outputs the commit hash for later stages

**Why it matters:**
- Prevents attempting to deploy a non-existent commit
- Ensures we're always promoting from main (security)

### 2. E2E Testing (test-staging)

**Purpose:** Run the full E2E test suite against the staging environment.

**What happens:**
- Downloads pre-built staging artifact (if available)
- Installs Playwright browsers
- Runs `npm run test:e2e` against the staging API/WebSocket endpoints
- Uploads test results as artifacts

**Why it matters:**
- Catches environment-specific issues before production
- Verifies the staging build is actually working
- Optional (can be skipped via `run_e2e_tests` input)

**When to skip:**
- Emergency hotfixes (requires explicit opt-out)
- When staging is known to be unstable
- Only with explicit team approval

### 3. Approval Gate (approve-production-deploy)

**Purpose:** Require manual approval before production deployment.

**What happens:**
- Job pauses and waits for review
- GitHub environment `production-promotion` is used
- Only users with `deploy` permission can approve
- Can require specific reviewers (configured in GitHub)

**Why it matters:**
- Prevents accidental production deployments
- Provides a checkpoint for team coordination
- Creates an audit trail of who approved the change

**How to approve:**
1. Go to the workflow run
2. Click **Review deployments**
3. Select reviewers (if required)
4. Click **Approve and deploy**

### 4. Production Deployment (deploy-production)

**Purpose:** Build and deploy the staging commit to production.

**What happens:**
- Checks out the validated staging commit
- Builds with production API/WebSocket endpoints
- Deploys to Vercel production project
- Creates a GitHub deployment record

**Why it matters:**
- Ensures production uses the correct API endpoints
- Creates a permanent deployment record
- Allows easy rollback to previous versions

### 5. Smoke Tests (smoke-test-production)

**Purpose:** Run lightweight tests to verify the production deployment succeeded.

**What happens:**
- Runs tests tagged with `@smoke` (fast, critical path only)
- Checks if the app loads and responds to requests
- Verifies the health endpoint is accessible

**Why it matters:**
- Catches immediate deployment issues
- Blocks rollback if tests fail
- Faster than full E2E suite (takes ~5 minutes)

### 6. Rollback (rollback-production)

**Purpose:** Automatically roll back if smoke tests fail.

**What happens:**
- Triggered only if smoke tests fail
- Lists recent Vercel deployments
- Provides rollback instructions
- Notifies the team

**Why it matters:**
- Limits blast radius of bad deployments
- Keeps manual control in operator's hands
- Creates a paper trail of rollback decisions

## Example Promotion Flow

```
10:00 - Developer pushes to main
        ↓
10:05 - CI pipeline runs, all checks pass
        ↓
10:10 - Code auto-deployed to staging
        ↓
10:15 - QA tests staging environment ✓
        ↓
10:30 - Developer triggers promotion workflow
        ↓
10:35 - E2E tests run against staging ✓
        ↓
10:45 - Approval gate pauses
        ↓
10:50 - Engineering lead approves promotion
        ↓
10:51 - Production deployment begins
        ↓
11:00 - Smoke tests pass ✓
        ↓
11:01 - Live in production! 🎉
```

## Monitoring a Promotion

### In GitHub Actions UI

1. Go to **Actions** → **Promote to Production**
2. Click the running workflow
3. Watch job status in real-time
4. Click on individual jobs for detailed logs

### View Deployment Status

After promotion succeeds:

1. Go to **Deployments** tab in repository
2. Find the production deployment
3. View deployment details and status

### Post-Deployment Checks

After a successful promotion:

```bash
# Verify production is live
curl https://oracle.example.com/health

# Check WebSocket connection
wscat -c wss://api.example.com

# View application logs in Vercel
vercel logs --prod
```

## Troubleshooting

### "Staging version not found"

The commit doesn't exist in main. Verify:

```bash
git log --oneline main | grep <commit-sha>
```

If not found, push the commit to main first.

### "E2E tests failed"

Staging environment has an issue. Check:

```bash
# Staging API is reachable?
curl https://staging-api.example.com/health

# Staging WebSocket is live?
wscat -c wss://staging-api.example.com

# Staging build is deployed?
curl https://staging.example.com/
```

To skip tests for emergency fixes (use sparingly):

1. Trigger workflow with `run_e2e_tests=false`
2. Document why tests were skipped
3. Plan to re-run full E2E suite after hotfix stabilizes

### "Approval gate timed out"

GitHub environment protection rules may have a timeout. Approve the deployment:

1. Go to **Actions** → **Promote to Production** (workflow run)
2. Click **Review deployments**
3. Click **Approve and deploy**

### "Smoke tests failed — rolled back"

Production deployment had an issue. Investigate:

1. Check post-deployment logs in the workflow
2. View production errors in Sentry (if configured)
3. Manual rollback (if needed):
   ```bash
   vercel ls  # List recent deployments
   vercel promote <deployment-url>  # Promote previous version
   ```

## Rollback Procedures

### Automatic Rollback (Smoke Tests Failed)

If smoke tests fail after production deployment, automatic rollback is triggered. Manual intervention is NOT required unless the automatic rollback itself fails.

### Manual Rollback to Previous Version

If you need to manually roll back production:

```bash
# List recent deployments
vercel ls --prod

# Promote a previous deployment to production
vercel promote <deployment-url>
```

### Rollback via Git

If a specific commit introduced the issue:

```bash
# Revert the offending commit
git revert <commit-sha>

# Push the revert commit
git push origin main

# CI will automatically deploy the revert to staging
# Then promote to production normally
```

## Best Practices

### Before Promoting

- [ ] **Test in staging** — Run manual E2E tests, check the UI
- [ ] **Verify data** — Ensure staging data isn't affected by the change
- [ ] **Check logs** — Look for errors in staging logs
- [ ] **Communicate** — Notify team if deploying during business hours
- [ ] **Have a rollback plan** — Know what to revert if things go wrong

### During Promotion

- [ ] **Monitor the workflow** — Watch each job complete
- [ ] **Be ready to respond** — Have someone available if issues arise
- [ ] **Avoid batch promotions** — Deploy one change at a time if possible
- [ ] **Communicate status** — Update team on promotion progress

### After Promotion

- [ ] **Run smoke tests** — Verify app is responding correctly
- [ ] **Check production metrics** — Look for errors in Sentry, uptime monitors
- [ ] **Notify stakeholders** — Let team know the promotion succeeded
- [ ] **Document the change** — Update release notes or changelog
- [ ] **Set rollback triggers** — Know when to rollback (error rate spike, downtime)

## Approval Requirements

By default, the `production-promotion` environment requires approval from:

- Users with `admin` or `maintain` role in the repository
- Or users explicitly configured as required reviewers

To configure approval requirements:

1. Go to **Settings** → **Environments** → **production-promotion**
2. Under "Deployment branches", enable branch protection
3. Under "Reviewers", add required reviewers (optional)
4. Enable "Prevent admins from bypassing above rules" (optional)

## Auditing

All promotions are recorded in GitHub for audit purposes:

1. Go to **Deployments** tab
2. View deployment history
3. Click each deployment to see:
   - When it was deployed
   - Who triggered it
   - Which commit was deployed
   - Deployment status and logs

For compliance:

```bash
# Export deployment history
gh api repos/:owner/:repo/deployments --paginate > deployments.json

# Search for specific deployment
gh api repos/:owner/:repo/deployments | grep -i "production"
```

## FAQ

**Q: Can I promote without running E2E tests?**
A: Yes, by setting `run_e2e_tests=false` when triggering the workflow. This should only be used for emergency hotfixes.

**Q: What if I accidentally approve a bad deployment?**
A: Rollback immediately using the Vercel CLI or by reverting the commit and re-deploying. See [Rollback Procedures](#rollback-procedures).

**Q: Can I schedule automatic promotions?**
A: GitHub Actions workflows can't be scheduled to run other workflows, but you could create a separate workflow that triggers promotions on a schedule (not recommended for production).

**Q: How long does a promotion take?**
A: Typically 5–10 minutes:
  - Validation: <1 min
  - E2E tests: 3–5 min (optional)
  - Approval gate: manual (1–5 min average)
  - Production deployment: 1–2 min
  - Smoke tests: 2–3 min

**Q: Can multiple promotions run simultaneously?**
A: GitHub concurrency settings prevent multiple promotions to the same environment. Queue them one at a time.

---

For more information, see:
- [docs/STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md) — Staging environment setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) — General deployment guide
- [.github/workflows/promote-to-production.yml](./.github/workflows/promote-to-production.yml) — Workflow source
