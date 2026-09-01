# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not open a
public GitHub issue**.  Instead, report it privately using one of these channels:

- **GitHub private vulnerability reporting** — use the "Report a vulnerability"
  button on the [Security tab](../../security/advisories/new) of this repository.
- **Email** — send details to the maintainers listed in `package.json` (or open a
  blank private advisory if no email is listed).

You will receive an acknowledgement within **72 hours** and a resolution timeline
within **7 days** of the initial report.

---

## Dependency Vulnerability Management

### Automated scanning

| Tool | Trigger | Purpose |
|------|---------|---------|
| `npm audit` in CI | Every push / pull request | Blocks merge on **critical** or **high** findings |
| Weekly security workflow (`.github/workflows/security.yml`) | Every Monday 08:00 UTC | Full audit report; opens / updates a GitHub issue when critical/high vulns are found |
| Dependabot (`.github/dependabot.yml`) | Weekly (Monday) | Automatic PRs for patch and minor dependency updates |

### Severity thresholds

The CI pipeline uses `npm audit --audit-level=high`.  This means:

| Severity | CI behaviour |
|----------|-------------|
| **Critical** | ❌ Fails the build immediately |
| **High** | ❌ Fails the build immediately |
| **Moderate** | ⚠️ Reported in the audit output but does not fail the build |
| **Low** | ℹ️ Reported but does not fail the build |

### Remediation SLA by severity

The following timelines apply from the point at which a vulnerability is confirmed
(CVE published and affects a version we use):

| Severity | Target remediation | Maximum deadline |
|----------|--------------------|-----------------|
| **Critical** (CVSS ≥ 9.0) | Within **24 hours** | **3 days** |
| **High** (CVSS 7.0–8.9) | Within **3 days** | **7 days** |
| **Moderate** (CVSS 4.0–6.9) | Within **2 weeks** | **30 days** |
| **Low** (CVSS < 4.0) | Next scheduled dependency update | **90 days** |

If a fix is not available within the deadline (e.g. upstream has not yet released a
patch), the affected dependency must be temporarily replaced with a safe alternative
or its usage must be removed.  Any exception requires an explicit decision recorded
in a GitHub issue with the `security` label.

### Handling Dependabot PRs

1. **Patch updates** — grouped into a single weekly PR by Dependabot.  Merge after
   CI passes; no manual review required unless the package is security-sensitive.
2. **Minor updates** — review the changelog before merging.  Run the test suite
   locally if the package is a runtime dependency.
3. **Major updates** — open a separate tracking issue, plan the upgrade, and test
   thoroughly.  Do not merge automatically.
4. **Security advisories** — Dependabot will open a PR immediately outside the
   normal schedule.  Treat as Critical/High per the SLA table above.

### Manual remediation steps

```bash
# See all current vulnerabilities
npm audit

# Apply automatic patch-level fixes
npm audit fix

# See what would change without applying (dry run)
npm audit fix --dry-run

# Force a breaking-change fix (use with care — review changelog first)
npm audit fix --force
```

---

## Scope

This policy applies to the frontend application in this repository.  Backend,
smart contract, and infrastructure security are handled in their respective
repositories.
