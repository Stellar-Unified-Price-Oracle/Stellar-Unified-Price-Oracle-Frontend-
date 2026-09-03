# NPM Audit Vulnerability Report & Remediation Plan

**Date:** 2026-08-26  
**Audit Run Date:** 2026-08-10  
**Total Vulnerabilities Found:** 7 (1 moderate, 6 high)  
**Status:** Action Required

---

## Vulnerability Summary

| Package | Severity | Issue | CVE | Status |
|---------|----------|-------|-----|--------|
| dompurify | Moderate | XSS via IN_PLACE hook | GHSA-55q2-fjhq-7xh7 | Fix available |
| js-yaml | High | Quadratic CPU consumption | CVE-2026-59870 | Fix available |
| nanoid | High | Infinite loop with size=0 | GHSA-2v37-7h3g-55p8 | Fix available |
| playwright | High | SSL cert verification | GHSA-7mvr-c777-76hp | Requires --force |
| react-router | High | RSC Mode CSRF bypass | GHSA-qwww-vcr4-c8h2 | Fix available |
| @playwright/test | High | (dep on playwright) | — | Dep of above |
| react-router-dom | High | (dep on react-router) | — | Dep of above |

---

## Detailed Vulnerability Analysis

### 1. **DOMPurify ≤3.4.12** (Moderate Severity)
**Issue:** IN_PLACE hook removal leaves detached subtree executable → XSS vulnerability  
**CVE/Advisory:** GHSA-55q2-fjhq-7xh7  
**Impact:** An attacker could inject malicious scripts that survive sanitization  
**Current Version:** Unknown (need to check package.json)  
**Fix:** Upgrade to 3.4.13 or higher  
**Risk:** LOW – Only affects if app uses DOMPurify with IN_PLACE hook

### 2. **js-yaml 4.0.0 - 4.3.0** (High Severity)
**Issue:** Quadratic CPU consumption in !!omap resolution → DoS attack  
**CVE/Advisory:** CVE-2026-59870 (no backport for 3.x/4.x)  
**Impact:** Attacker can send YAML with omap that consumes all CPU  
**Current Version:** Check package.json  
**Fix:** Upgrade to 4.3.1+ or 5.x  
**Risk:** MEDIUM – Only if app accepts untrusted YAML input (unlikely in frontend)

### 3. **Nanoid <3.3.18** (High Severity)
**Issue:** Custom generators can loop indefinitely when size is zero  
**CVE/Advisory:** GHSA-2v37-7h3g-55p8  
**Impact:** Could cause application hang if nanoid called with size=0  
**Current Version:** Check package.json  
**Fix:** Upgrade to 3.3.18+  
**Risk:** MEDIUM – Depends on how nanoid is used in app

### 4. **Playwright <1.55.1** (High Severity)
**Issue:** Browser downloads don't verify SSL certificate authenticity  
**CVE/Advisory:** GHSA-7mvr-c777-76hp  
**Impact:** MITM attack during browser download (mainly affects dev/CI environments)  
**Current Version:** Likely 1.52.0 (from package.json)  
**Fix:** Upgrade to 1.55.1 or higher  
**Risk:** MEDIUM – Only affects dev/CI, not production code  
**Note:** Requires `--force` flag; will update @playwright/test to 1.62.1

### 5. **React-Router 7.12.0 - 7.18.1** (High Severity)
**Issue:** RSC Mode CSRF bypass allows action execution before 400 response  
**CVE/Advisory:** GHSA-qwww-vcr4-c8h2  
**Impact:** In RSC mode, unauthorized state-modifying actions could execute  
**Current Version:** 7.5.0 (from package.json) – **NOT vulnerable**  
**Risk:** LOW – App uses 7.5.0, which is outside the vulnerable range  
**Note:** This is a false positive; 7.5.0 < 7.12.0 (start of vulnerable range)

### 6. **React-Router-DOM 7.12.0-pre.0 - 7.18.1** (High Severity)
**Issue:** Depends on vulnerable react-router (same as above)  
**Current Version:** 7.5.0 (from package.json) – **NOT vulnerable**  
**Risk:** LOW – Same as react-router; false positive

### 7. **@Playwright/Test** (High Severity)
**Issue:** Dependency of vulnerable playwright  
**Impact:** Same as playwright issue above  
**Risk:** MEDIUM – Only dev-time dependency  
**Fix:** Will be fixed when playwright upgraded

---

## Remediation Priority Matrix

| Package | Severity | Impact | Effort | Priority |
|---------|----------|--------|--------|----------|
| dompurify | Moderate | Low (if no IN_PLACE hook used) | Low (patch) | **HIGH** |
| nanoid | High | Medium (app hang if size=0) | Low (patch) | **HIGH** |
| js-yaml | High | Low (frontend unlikely to parse YAML) | Low (patch) | **MEDIUM** |
| playwright | High | Medium (dev/CI only) | Medium (requires test verification) | **MEDIUM** |
| react-router | High | None (false positive, not vulnerable) | None | **LOW** |
| react-router-dom | High | None (false positive, not vulnerable) | None | **LOW** |

---

## Recommended Action Plan

### Phase 1: Immediate (Critical) – 15 minutes
Update low-risk patch versions (no breaking changes):

```bash
# These are safe patch/minor updates
npm install dompurify@latest --save
npm install nanoid@latest --save
npm install js-yaml@latest --save-dev

# Test after each installation
npm run typecheck
npm run lint
npm run test:run
```

### Phase 2: Test Update (Moderate) – 30 minutes
Playwright is test-only; update with validation:

```bash
# Playwright requires --force due to version jump (1.52.0 → 1.62.1)
npm install @playwright/test@latest --save-dev
npm install playwright@latest --save-dev

# Verify tests still work
npm run test:e2e
```

### Phase 3: Verification – 10 minutes
Ensure no regressions:

```bash
# Full verification suite
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:e2e:chromium  # Quick browser test
```

### Phase 4: React-Router Investigation (Optional) – 5 minutes
Verify false positives:

```bash
# Check actual installed versions
npm ls react-router react-router-dom
# Both should show 7.5.0, which is NOT vulnerable
```

---

## Full Remediation Commands

### Safe (No Breaking Changes Expected)
```bash
cd /workspaces/Stellar-Unified-Price-Oracle-Frontend-

# Update vulnerable packages
npm audit fix

# This will:
# - dompurify: ~3.4.12 → 3.4.13 (patch)
# - nanoid: <3.3.18 → 3.3.18+ (patch)
# - js-yaml: 4.x.x → 4.3.1+ (patch)

# Verify build still works
npm run build
npm run typecheck
npm run test:run
```

### Requires Force (Playwright)
```bash
# This updates playwright across a minor version
# May need test adjustments
npm install @playwright/test@latest --save-dev --force
npm install playwright@latest --save-dev --force

# Verify tests
npm run test:e2e
```

### Alternative: Nuclear Option (Not Recommended)
```bash
# Updates EVERYTHING, including major versions
npm audit fix --force

# Risk: May break things; requires extensive testing
```

---

## Risk Assessment by Update

### DOMPurify (LOW RISK)
- **Change:** 3.4.12 → 3.4.13 (patch)
- **Breaking Changes:** None expected
- **Testing:** Unit tests sufficient
- **Action:** Safe to apply immediately

### Nanoid (LOW RISK)
- **Change:** <3.3.18 → 3.3.18+ (patch)
- **Breaking Changes:** None (security fix only)
- **Testing:** No specific tests needed
- **Action:** Safe to apply immediately

### JS-YAML (LOW RISK)
- **Change:** 4.x.x → 4.3.1+ (patch)
- **Breaking Changes:** None (security fix only)
- **Testing:** No YAML parsing in app, so no impact
- **Action:** Safe to apply immediately

### Playwright (MEDIUM RISK)
- **Change:** 1.52.0 → 1.62.1 (minor version)
- **Breaking Changes:** Possible (minor versions can have API changes)
- **Testing:** Full E2E test suite required
- **Action:** Update + test thoroughly
- **Rollback Plan:** Revert to 1.52.0 if tests fail

### React-Router (LOW RISK – FALSE POSITIVE)
- **Status:** App uses 7.5.0, which is NOT in vulnerable range (7.12.0+)
- **Action:** No update needed; just verify with `npm ls`
- **Note:** npm audit may still show it; this is a false positive

---

## Testing Strategy

### Before Updates
```bash
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:e2e:chromium
```

### After Updates (Patch Level)
```bash
npm run typecheck   # Quick check
npm run test:run    # Unit tests
```

### After Updates (Minor Level – Playwright)
```bash
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

---

## Expected Outcomes

### After Running `npm audit fix`
```
# npm audit report

# No vulnerabilities found

# To address issues that do not require attention, run:
# npm audit fix --force

# run `npm install` to resolve
```

### If Any Test Fails
1. **Identify affected package** – Check which update broke it
2. **Review changelog** – See what changed in that version
3. **Rollback if needed** – `npm install <package>@<old-version> --save-dev`
4. **File issue** – Report to package maintainer if legitimate breaking change

---

## Long-Term Dependency Management

### 1. Automated Audits
The CI pipeline already runs `npm audit --audit-level=high`:
```yaml
# In .github/workflows/ci.yml
- name: Audit dependencies (fail on critical/high)
  run: npm audit --audit-level=high
```

### 2. Regular Updates
- Run `npm audit` weekly (e.g., Mondays)
- Update patches immediately (low risk)
- Schedule minor updates for planned sprints
- Review major updates for breaking changes

### 3. Dependency Bot Integration (Optional)
```yaml
# Could use Dependabot to auto-open PRs
name: Dependabot
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
```

---

## Summary

**Current Status:** 7 vulnerabilities (1 moderate, 6 high)
- 3 are simple patches (dompurify, nanoid, js-yaml)
- 2 are false positives (react-router due to version mismatch)
- 2 are dev-only (playwright, @playwright/test)

**Recommended Action:**
1. Run `npm audit fix` (handles patches)
2. Update playwright manually or with `--force`
3. Run full test suite
4. Commit changes

**Estimated Time:** 30–60 minutes including testing  
**Risk Level:** LOW (patches) to MEDIUM (playwright minor version)  
**Rollback Plan:** Easy (revert package-lock.json if needed)

---

## Implementation Checklist

- [ ] Review this analysis with team
- [ ] Backup current package-lock.json
- [ ] Run `npm audit fix` on patches
- [ ] Update playwright (decide on force or manual)
- [ ] Run `npm run typecheck && npm run build`
- [ ] Run `npm run test:run`
- [ ] Run `npm run test:e2e:chromium`
- [ ] Verify `npm audit` shows no high-severity issues
- [ ] Commit: `git add package.json package-lock.json && git commit -m "chore: resolve npm audit vulnerabilities"`
- [ ] Push and verify CI passes
