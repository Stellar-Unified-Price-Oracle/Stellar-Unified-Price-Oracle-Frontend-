# Staging Environment Setup Checklist

Quick reference for setting up the staging deployment pipeline.

## ✅ Pre-Setup Verification

- [ ] You have admin/maintainer access to the GitHub repository
- [ ] You have a Vercel account with API access
- [ ] You have staging and production API endpoints available
- [ ] You have SSH access to configure GitHub secrets

## ✅ Step 1: Create Vercel Projects

```bash
# Create staging project
vercel projects add stellar-oracle-frontend-staging

# Create production project  
vercel projects add stellar-oracle-frontend-production

# Get project IDs
vercel projects list
```

Record:
- [ ] Staging project ID: `_________________`
- [ ] Production project ID: `_________________`
- [ ] Organization/Team ID: `_________________`

## ✅ Step 2: Configure GitHub Repository Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**

### Vercel Credentials (shared across staging & production)

```
VERCEL_TOKEN = <your-personal-access-token>
VERCEL_ORG_ID = <your-organization-id>
```

### Staging Configuration

```
VERCEL_STAGING_PROJECT_ID = <staging-project-id>
STAGING_API_URL = https://staging-api.example.com/api
STAGING_WS_URL = wss://staging-api.example.com
```

### Production Configuration

```
VERCEL_PRODUCTION_PROJECT_ID = <production-project-id>
PRODUCTION_API_URL = https://api.example.com/api
PRODUCTION_WS_URL = wss://api.example.com
```

### Optional: Error Tracking (Sentry)

```
SENTRY_AUTH_TOKEN = <sentry-auth-token>
SENTRY_ORG = <sentry-organization>
SENTRY_PROJECT = <sentry-project-id>
```

**Verification:**
```bash
gh secret list
```

Should output all secrets with ✓ status.

## ✅ Step 3: Set Up Basic Auth for Staging

```bash
# Generate and configure credentials
./scripts/setup-staging-auth.sh

# This will:
# - Generate username/password
# - Update GitHub secrets
# - Update Vercel environment variables
```

Record:
- [ ] Staging username: `_________________`
- [ ] Staging password: `_________________`

**Verify:**
```bash
./scripts/verify-staging-security.sh \
  --user <username> \
  --pass <password>
```

## ✅ Step 4: Configure GitHub Environments

Go to **Settings → Environments**

### Create `staging` environment

1. Click **New environment**
2. Name: `staging`
3. Click **Configure environment**
4. No deployment branches (auto-allowed)
5. No required reviewers
6. No secrets needed (uses repository secrets)
7. Save

### Create `production-promotion` environment

1. Click **New environment**
2. Name: `production-promotion`
3. Click **Configure environment**
4. Deployment branches: `main` only
5. Required reviewers: select team leads (recommended: 1)
6. No secrets needed
7. Save

### Create `production` environment

1. Click **New environment**
2. Name: `production`
3. Click **Configure environment**
4. Deployment branches: `main` only
5. Required reviewers: select team leads (recommended: 1)
6. No secrets needed
7. Save

## ✅ Step 5: Verify CI Workflows

```bash
# List workflows
gh workflow list

# Should show:
# - CI (active)
# - Promote to Production (active)
```

### Check CI workflow triggers

```bash
# View CI workflow configuration
cat .github/workflows/ci.yml | grep -A 5 "on:"

# Should include:
# - push to main
# - pull requests to main
```

### Check promotion workflow triggers

```bash
# Verify promotion workflow exists
[ -f .github/workflows/promote-to-production.yml ] && echo "✓ Found"
```

## ✅ Step 6: Test Staging Deployment

```bash
# Make a small test commit
echo "# Test deployment" >> docs/STAGING_DEPLOYMENT.md
git add docs/STAGING_DEPLOYMENT.md
git commit -m "test: staging deployment pipeline"
git push origin main

# Monitor CI pipeline
gh workflow view CI
```

**Expected:**
- [ ] CI pipeline runs and passes
- [ ] `deploy-staging` job completes
- [ ] Staging deployment created in GitHub Deployments tab

**Verify staging is live:**
```bash
# Replace with your staging URL
curl -u staging-user:staging-password https://staging.example.com/

# Should return HTML (app homepage)
```

## ✅ Step 7: Document Environment URLs

Update these in your team documentation:

- Staging URL: `https://staging.example.com`
- Production URL: `https://oracle.example.com`
- Staging basic auth username: (stored in vault)
- Staging basic auth password: (stored in vault)

## ✅ Step 8: Team Communication

Share with your team:

1. **Staging deployment guide:** [docs/STAGING_DEPLOYMENT.md](../docs/STAGING_DEPLOYMENT.md)
2. **Production promotion workflow:** [docs/PRODUCTION_PROMOTION.md](../docs/PRODUCTION_PROMOTION.md)
3. **Staging credentials:** (via secure channel, never in Slack/email)
4. **Approval process:** Who approves promotions to production

## ✅ Ongoing Maintenance

### Weekly

- [ ] Monitor deployment logs in GitHub Actions
- [ ] Check for any CI/CD failures
- [ ] Verify staging is accessible

### Monthly

- [ ] Review and rotate basic auth credentials
- [ ] Audit deployment history via `gh api repos/:owner/:repo/deployments`
- [ ] Update documentation with any changes

### Quarterly

- [ ] Review approval requirements
- [ ] Analyze promotion metrics (success rate, deployment time)
- [ ] Optimize CI/CD pipeline if bottlenecks emerge

## 🆘 Troubleshooting

### CI workflow not triggering

**Problem:** Push to main but CI doesn't run

**Solutions:**
1. Check workflow file exists: `.github/workflows/ci.yml`
2. Verify workflow is enabled: **Actions → Enable workflows**
3. Check branch protection rules don't prevent CI
4. Manually trigger: `gh workflow run ci.yml --ref main`

### Staging deployment fails

**Problem:** CI passes but `deploy-staging` fails

**Check:**
- [ ] `VERCEL_TOKEN` is valid (not expired)
- [ ] `VERCEL_STAGING_PROJECT_ID` is correct
- [ ] `STAGING_API_URL` and `STAGING_WS_URL` are accessible
- [ ] Vercel project settings are configured

**View logs:**
```bash
gh workflow view deploy-staging
```

### Can't access staging (401 Unauthorized)

**Problem:** Basic auth not working

**Check:**
- [ ] Credentials are correct
- [ ] Vercel staging project has basic auth enabled
- [ ] Environment variables `STAGING_BASIC_AUTH_USER` and `STAGING_BASIC_AUTH_PASS` are set
- [ ] Re-run: `./scripts/verify-staging-security.sh`

### Smoke tests fail after production deploy

**Problem:** Deployment rolled back automatically

**Investigate:**
1. Check workflow logs: **Actions → Promote to Production → smoke-test-production**
2. View post-deployment logs in Vercel
3. Check application errors in Sentry (if configured)
4. Manually verify production: `curl https://oracle.example.com/`

## 📚 Additional Resources

- [Staging Deployment Guide](../docs/STAGING_DEPLOYMENT.md) — Detailed staging operations
- [Production Promotion Workflow](../docs/PRODUCTION_PROMOTION.md) — How to promote to production
- [Main Deployment Guide](../DEPLOYMENT.md) — General deployment reference
- [CI Workflow](./.github/workflows/ci.yml) — Automated testing and staging deployment
- [Promotion Workflow](./.github/workflows/promote-to-production.yml) — Gated production deployment

---

**Need help?** Check the troubleshooting section above or refer to the detailed guides linked above.
