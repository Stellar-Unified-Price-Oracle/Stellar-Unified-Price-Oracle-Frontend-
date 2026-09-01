# Staging Environment — Next Steps

The staging environment implementation is complete. Here's what to do now.

## 📋 Implementation Checklist

### Phase 1: Review & Validate (30 minutes)

- [ ] Read [STAGING_README.md](./STAGING_README.md) — Overview of the entire setup
- [ ] Review [docs/STAGING_SETUP_CHECKLIST.md](./docs/STAGING_SETUP_CHECKLIST.md) — What needs to be configured
- [ ] Review CI workflow: `.github/workflows/ci.yml` — New `deploy-staging` job
- [ ] Review promotion workflow: `.github/workflows/promote-to-production.yml` — Manual gated deployment

### Phase 2: Configure Vercel (30 minutes)

- [ ] Create staging project: `vercel projects add stellar-oracle-frontend-staging`
- [ ] Create production project: `vercel projects add stellar-oracle-frontend-production`
- [ ] Record project IDs
- [ ] Set environment variables in both Vercel projects

### Phase 3: Configure GitHub (45 minutes)

- [ ] Create GitHub repository secrets (see [docs/STAGING_SETUP_CHECKLIST.md](./docs/STAGING_SETUP_CHECKLIST.md))
- [ ] Create GitHub environments: `staging`, `production-promotion`, `production`
- [ ] Configure environment protection rules (if needed)
- [ ] Verify workflows are enabled: **Settings → Actions → General → Allow all actions**

### Phase 4: Set Up Access Control (15 minutes)

- [ ] Run: `./scripts/setup-staging-auth.sh`
- [ ] Store credentials in vault (1Password, LastPass, etc.)
- [ ] Share with team securely
- [ ] Verify: `./scripts/verify-staging-security.sh`

### Phase 5: Test Deployment (10 minutes)

- [ ] Make a small test commit to `main`
- [ ] Monitor CI pipeline: **Actions → CI**
- [ ] Verify `deploy-staging` job completes
- [ ] Access staging: `https://staging.example.com` with basic auth

### Phase 6: Test Promotion (15 minutes)

- [ ] Go to **Actions → Promote to Production**
- [ ] Click **Run workflow**
- [ ] Select "latest" staging commit
- [ ] Keep "run_e2e_tests" enabled
- [ ] Watch the workflow complete
- [ ] Request approval when prompted
- [ ] Verify smoke tests pass

### Phase 7: Communicate to Team (20 minutes)

- [ ] Share staging URL and credentials (secure channel only)
- [ ] Share [docs/STAGING_DEPLOYMENT.md](./docs/STAGING_DEPLOYMENT.md) — Daily operations guide
- [ ] Share [docs/PRODUCTION_PROMOTION.md](./docs/PRODUCTION_PROMOTION.md) — How to promote to production
- [ ] Conduct team walkthrough (15 minutes)

## 📊 Configuration Summary

### Files to Configure

| File | What to Do |
|------|-----------|
| `.env.staging` | Already created (template) |
| `.env.production` | Already created (template) |
| `.github/workflows/ci.yml` | ✅ Already implemented |
| `.github/workflows/promote-to-production.yml` | ✅ Already implemented |
| `vercel.json` | ✅ Already updated |

### GitHub Secrets to Add

```bash
# Run: gh secret set <KEY> --body '<VALUE>'

gh secret set VERCEL_TOKEN --body '...'
gh secret set VERCEL_ORG_ID --body '...'

gh secret set VERCEL_STAGING_PROJECT_ID --body '...'
gh secret set STAGING_API_URL --body 'https://staging-api.example.com/api'
gh secret set STAGING_WS_URL --body 'wss://staging-api.example.com'
gh secret set STAGING_BASIC_AUTH_USER --body 'staging-user'
gh secret set STAGING_BASIC_AUTH_PASS --body '...'

gh secret set VERCEL_PRODUCTION_PROJECT_ID --body '...'
gh secret set PRODUCTION_API_URL --body 'https://api.example.com/api'
gh secret set PRODUCTION_WS_URL --body 'wss://api.example.com'

# Optional:
gh secret set SENTRY_AUTH_TOKEN --body '...'
gh secret set SENTRY_ORG --body '...'
gh secret set SENTRY_PROJECT --body '...'
```

### GitHub Environments to Create

```bash
# Create via UI: Settings → Environments

# Staging
- Name: staging
- Deployment branches: main only
- Required reviewers: (optional)

# Production Promotion
- Name: production-promotion
- Deployment branches: main only
- Required reviewers: select team leads (recommended)

# Production
- Name: production
- Deployment branches: main only
- Required reviewers: select team leads (recommended)
```

## 🎯 Usage After Setup

### Daily Development

```bash
# Just push to main — staging auto-deploys
git push origin main

# Monitor deployment: Actions → CI → deploy-staging
```

### Promoting to Production

```bash
# Go to Actions → Promote to Production
# Click "Run workflow"
# Wait for tests and approval
# Once approved, automatically deploys
```

## 🚨 Important Notes

### Secrets Management
- **Never commit `.env.production` or `.env.staging`** with real values
- Use GitHub repository secrets instead
- Rotate basic auth credentials quarterly
- Store in secure vault (1Password, LastPass, Vault, etc.)

### Vercel Configuration
- Staging and production **must** be separate projects
- Each project needs its own environment variables
- Basic auth must be configured in Vercel staging project
- Custom domain can point to either project

### GitHub Approval Requirements
- Default: users with `admin` or `maintain` role can approve
- Consider requiring specific reviewers for production
- Approval history is audited in GitHub

## 📚 Documentation Available

| Document | Use When | Audience |
|----------|----------|----------|
| [STAGING_README.md](./STAGING_README.md) | Need overview | Everyone |
| [docs/STAGING_SETUP_CHECKLIST.md](./docs/STAGING_SETUP_CHECKLIST.md) | Setting up initially | DevOps/Platform |
| [docs/STAGING_DEPLOYMENT.md](./docs/STAGING_DEPLOYMENT.md) | Daily operations | All developers |
| [docs/PRODUCTION_PROMOTION.md](./docs/PRODUCTION_PROMOTION.md) | Promoting to production | All developers |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | General deployment help | All developers |

## 🆘 Troubleshooting

### CI workflow not running
1. Verify `.github/workflows/ci.yml` exists
2. Check **Actions → Enable workflows**
3. Verify branch protection doesn't prevent CI

### Staging deployment fails
1. Check secrets: `gh secret list`
2. Check Vercel project ID is correct
3. View logs: **Actions → CI → deploy-staging**

### Can't access staging
1. Verify basic auth credentials
2. Run: `./scripts/verify-staging-security.sh`
3. Check Vercel project has basic auth enabled

For more help, see the troubleshooting sections in:
- [docs/STAGING_DEPLOYMENT.md#troubleshooting](./docs/STAGING_DEPLOYMENT.md#troubleshooting)
- [docs/PRODUCTION_PROMOTION.md#troubleshooting](./docs/PRODUCTION_PROMOTION.md#troubleshooting)

## ✅ Validation Checklist

After implementation, verify:

- [ ] CI workflow runs and passes on main
- [ ] Staging project created and configured in Vercel
- [ ] Production project created and configured in Vercel
- [ ] All GitHub secrets are set (`gh secret list`)
- [ ] GitHub environments are created
- [ ] Staging is accessible with basic auth
- [ ] Production promotion workflow can be triggered
- [ ] E2E tests pass against staging
- [ ] Team has been trained on new workflow

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the detailed documentation in `docs/`
3. Check GitHub Actions logs: **Actions → [Workflow Name] → [Run] → [Job]**
4. Run verification scripts:
   - `./scripts/verify-staging-security.sh`
5. Escalate to platform/DevOps team if blocked

---

## Timeline Estimate

| Phase | Time | Dependencies |
|-------|------|--------------|
| Review & Validate | 30 min | None |
| Configure Vercel | 30 min | Vercel account |
| Configure GitHub | 45 min | Admin access |
| Set Up Access Control | 15 min | None |
| Test Deployment | 10 min | All above |
| Test Promotion | 15 min | All above |
| Communicate | 20 min | All above |
| **Total** | **2.5 hours** | — |

After initial setup, ongoing maintenance is ~10 minutes per month.

---

**Ready to proceed?** Start with Phase 1 by reading [STAGING_README.md](./STAGING_README.md).
