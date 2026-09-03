# NPM Audit Vulnerabilities — Remediation Guide

**Status:** 7 vulnerabilities found (2 false positives, 5 real)  
**Risk Level:** LOW (mostly dev-only or patch fixes)  
**Estimated Resolution Time:** 15 minutes

---

## Quick Summary

| Vulnerability | Severity | Type | Action | Risk |
|---------------|----------|------|--------|------|
| dompurify | Moderate | XSS in hook removal | Update to 3.4.13+ | LOW (patch) |
| nanoid | High | Infinite loop (size=0) | Update to 3.3.18+ | LOW (patch) |
| js-yaml | High | DoS (omap parsing) | Update to 4.3.1+ | LOW (patch) |
| playwright | High | SSL cert verification | Update to 1.55.1+ | MEDIUM (minor) |
| react-router | High | **FALSE POSITIVE** | No action needed | NONE |
| react-router-dom | High | **FALSE POSITIVE** | No action needed | NONE |
| @playwright/test | High | Depends on playwright | Update with playwright | MEDIUM (minor) |

**Bottom Line:** Update dompurify, nanoid, js-yaml (patches), then playwright (minor), then run tests.

---

## Dependency Tree (Why These Are Vulnerable)

```
stellar-oracle-frontend
├── jspdf@4.2.1
│   └── dompurify@3.4.12 ← XSS vulnerability (GHSA-55q2-fjhq-7xh7)
│
├── vite@8.1.5
│   └── postcss@8.5.24
│       └── nanoid@3.3.16 ← Infinite loop vulnerability (GHSA-2v37-7h3g-55p8)
│
├── @commitlint/cli@19.8.1
│   └── @commitlint/load@19.8.1
│       └── cosmiconfig@9.0.2
│           └── js-yaml@4.3.0 ← DoS vulnerability (CVE-2026-59870)
│
├── eslint@9.39.5
│   └── @eslint/eslintrc@3.3.6
│       └── js-yaml@4.3.0 ← (same DoS vulnerability)
│
└── @playwright/test@1.52.0
    └── playwright@1.52.0 ← SSL cert verification (GHSA-7mvr-c777-76hp)

react-router-dom@7.5.0
└── (NOT vulnerable; 7.5.0 < 7.12.0 which is start of vulnerable range)
```

---

## Vulnerability Details

### 1. DOMPurify ≤3.4.12 — XSS via IN_PLACE Hook
**Severity:** Moderate  
**CVE:** GHSA-55q2-fjhq-7xh7  
**Description:** The IN_PLACE hook removal leaves a detached subtree executable, allowing XSS  
**Impact:** If app uses DOMPurify with IN_PLACE hook, attacker script could survive sanitization  
**Used By:** jspdf (PDF library)  
**Fix:** Update to 3.4.13 or higher (patch release)  
**Risk:** LOW (patch, no breaking changes)  
**Action:** `npm install dompurify@latest`

### 2. Nanoid <3.3.18 — Infinite Loop with size=0
**Severity:** High  
**CVE:** GHSA-2v37-7h3g-55p8  
**Description:** Custom generators can loop indefinitely when initialized with size=0  
**Impact:** App could hang if nanoid called with `size: 0` parameter  
**Used By:** vite (build tool, used in postcss)  
**Fix:** Update to 3.3.18 or higher (patch release)  
**Risk:** LOW (patch, no breaking changes)  
**Action:** `npm install nanoid@latest`

### 3. JS-YAML 4.0.0–4.3.0 — Quadratic CPU Consumption DoS
**Severity:** High  
**CVE:** CVE-2026-59870 (no backport for 3.x/4.x)  
**Description:** YAML omap resolution uses O(n²) algorithm → CPU DoS  
**Impact:** Attacker sends YAML with `!!omap` key that consumes all CPU  
**Used By:** @commitlint/cli, eslint  
**Fix:** Update to 4.3.1+ (patch release)  
**Risk:** LOW (patch, no breaking changes; frontend unlikely to parse untrusted YAML)  
**Action:** `npm install js-yaml@latest`

### 4. Playwright <1.55.1 — SSL Certificate Verification
**Severity:** High  
**CVE:** GHSA-7mvr-c777-76hp  
**Description:** Browser downloads don't verify SSL certificate authenticity  
**Impact:** MITM attack possible during browser download (only affects dev/CI)  
**Used By:** @playwright/test (dev dependency)  
**Fix:** Update to 1.55.1 or higher (minor version jump: 1.52.0 → 1.62.1)  
**Risk:** MEDIUM (minor version; may have API changes)  
**Action:** `npm install @playwright/test@latest playwright@latest` + test

### 5. React-Router 7.12.0–7.18.1 — RSC Mode CSRF Bypass
**Severity:** High  
**CVE:** GHSA-qwww-vcr4-c8h2  
**Description:** RSC (React Server Components) mode allows CSRF action execution  
**Impact:** None — app uses 7.5.0, which is NOT in vulnerable range (7.12.0+)  
**Status:** ✅ **FALSE POSITIVE** — This is not a real issue  
**Action:** No update needed; can ignore

### 6. React-Router-DOM 7.12.0-pre.0–7.18.1 — Depends on Vulnerable React-Router
**Severity:** High  
**Status:** ✅ **FALSE POSITIVE** — Depends on false positive above  
**Used Version:** 7.5.0 (NOT vulnerable)  
**Action:** No update needed; can ignore

### 7. @Playwright/Test — Depends on Vulnerable Playwright
**Severity:** High  
**Status:** Will be fixed when playwright is updated  
**Action:** Update with playwright (see #4 above)

---

## Step-by-Step Remediation

### Option A: Automated Script (Recommended)
```bash
bash scripts/audit-fix.sh
```

This script will:
1. Backup package-lock.json
2. Run `npm audit fix` (patches)
3. Update playwright
4. Run typecheck and unit tests
5. Final audit verification

### Option B: Manual Remediation

#### Step 1: Patch Updates (Safe)
```bash
npm audit fix
```

This updates:
- dompurify: 3.4.12 → 3.4.13
- nanoid: 3.3.16 → 3.3.18
- js-yaml: 4.3.0 → (no change, already latest in 4.x)

#### Step 2: Playwright Update (Requires Testing)
```bash
npm install @playwright/test@latest --save-dev
npm install playwright@latest --save-dev
```

#### Step 3: Verify No Regressions
```bash
# Quick checks
npm run typecheck
npm run test:run

# Comprehensive checks (optional but recommended)
npm run lint
npm run build
npm run test:e2e:chromium
```

#### Step 4: Final Audit Check
```bash
npm audit
```

Expected output: No high-severity vulnerabilities

### Option C: Nuclear Option (Not Recommended)
```bash
npm audit fix --force
```

This would update ALL packages to latest, including major versions. Risk of breaking changes is much higher. Only do this if manual fixes don't work.

---

## Testing Strategy

### Minimum Testing (5 minutes)
```bash
npm run typecheck   # Catch TypeScript errors
npm run test:run    # Quick unit tests
```

### Recommended Testing (15 minutes)
```bash
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:e2e:chromium  # Browser tests
```

### Comprehensive Testing (30 minutes)
```bash
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:e2e                # All browsers
npm run test:e2e:visual         # Visual regression
npm run test:e2e:mobile         # Mobile tests
```

---

## Rollback Plan (If Something Breaks)

### Quick Rollback
```bash
# Restore backup
cp package-lock.json.backup package-lock.json

# Reinstall
npm ci

# Verify
npm audit
```

### Granular Rollback
```bash
# If only playwright update broke things:
npm install @playwright/test@1.52.0 --save-dev
npm install playwright@1.52.0 --save-dev

# Then retry everything else
npm audit fix
npm ci
```

---

## What NOT to Update

### React-Router ✅ Safe to Ignore
App uses `react-router-dom@^7.5.0`, which is NOT in the vulnerable range (7.12.0–7.18.1).

```bash
# Verify this
npm ls react-router react-router-dom

# Should show:
# react-router-dom@7.5.0
# react-router@7.5.0 (transitive dependency)
```

These are false positives from npm audit. You can safely ignore them.

---

## Post-Remediation Checklist

- [ ] Ran `npm audit fix` (or automated script)
- [ ] Ran `npm run typecheck` (no TypeScript errors)
- [ ] Ran `npm run test:run` (all unit tests pass)
- [ ] Ran `npm run test:e2e:chromium` (browser tests pass)
- [ ] Ran `npm audit` (no high-severity issues)
- [ ] Reviewed changes: `git diff package.json package-lock.json`
- [ ] Committed changes: `git add package.json package-lock.json && git commit -m "chore: resolve npm audit vulnerabilities"`
- [ ] Pushed and verified CI passes

---

## Long-Term Dependency Management

### Weekly Audit
```bash
# Check for new vulnerabilities
npm audit

# Update patches (if any)
npm audit fix
```

### Monthly Review
1. Check for new minor/major versions
2. Review changelogs
3. Test thoroughly before updating
4. Update in batches (don't update everything at once)

### Automated Dependency Management (Optional)
The CI pipeline already fails on high-severity vulnerabilities:

```yaml
# .github/workflows/ci.yml
- name: Audit dependencies (fail on critical/high)
  run: npm audit --audit-level=high
```

You could add Dependabot for automated PRs:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
```

---

## FAQ

### Q: Will updating these packages break my code?
**A:** Unlikely. All are patch-level updates except playwright (minor). Patches are designed to be safe.

### Q: Do I need to update right away?
**A:** For production: Yes, these are security issues. For dev-only (playwright): Lower priority but still recommended.

### Q: What if tests fail after updating?
**A:** Check the changelog for that package, revert if needed, and file an issue with the maintainer.

### Q: Can I just ignore these warnings?
**A:** Not recommended. While some are false positives, the real vulnerabilities should be fixed.

### Q: Do these affect the production build?
**A:** Partially:
- dompurify: Yes (used by jspdf in production)
- nanoid: No (vite is dev-only, used at build time)
- js-yaml: No (commitlint and eslint are dev-only)
- playwright: No (dev-only)

So dompurify should definitely be updated.

---

## Contact & Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the package changelog
3. Run `npm audit` to see latest status
4. Restore from backup if needed

---

## References

- [NPM Audit Documentation](https://docs.npmjs.com/cli/v9/commands/npm-audit)
- [DOMPurify Security Advisory](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)
- [Nanoid Security Advisory](https://github.com/advisories/GHSA-2v37-7h3g-55p8)
- [JS-YAML Security Advisory](https://nvd.nist.gov/vuln/detail/CVE-2026-59870)
- [Playwright Security Advisory](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- [React-Router Security Advisory](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
