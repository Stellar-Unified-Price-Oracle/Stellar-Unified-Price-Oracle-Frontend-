# Contributing to Stellar Unified Price Oracle — Frontend

Thank you for your interest in contributing. This guide covers everything you need
to get set up, the workflow we use for changes, and the standards we hold code to.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Report Issues](#how-to-report-issues)
3. [How to Request Features](#how-to-request-features)
4. [Development Setup](#development-setup)
5. [Branch Naming & Commit Messages](#branch-naming--commit-messages)
6. [Pull Request Workflow](#pull-request-workflow)
7. [Coding Standards](#coding-standards)
8. [Testing Requirements](#testing-requirements)
9. [Documentation Requirements](#documentation-requirements)
10. [PR Review Checklist](#pr-review-checklist)
11. [Quarterly Major Dependency Upgrade Sweep](#quarterly-major-dependency-upgrade-sweep)

---

## Code of Conduct

We follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

**TL;DR**: be respectful, assume good intent, keep criticism technical and constructive.
Harassment, discrimination, and personal attacks have no place here.

If you experience or witness a violation, report it by opening a private discussion
or emailing the maintainers listed in `package.json`. All reports are treated
confidentially. Maintainers are obligated to respond within 72 hours.

### Moderation workflow

Community surfaces (governance proposals, the reliability leaderboard, feedback and
translation contributions) carry a **Report** action. Each report records a category
and evidence — never the reporter's identity — and moves through:

1. **Triage** — a moderator reviews the report against this Code of Conduct.
2. **Decide** — a decision (no violation, warning, content removed, temporary or
   permanent ban) is recorded with a rationale.
3. **Action** — the decision is carried out.
4. **Notify** — the reporter and affected party are informed. Evidence marked
   confidential is visible to moderators only.

Anonymized counts by category, stage, and decision are published at `/moderation`, and
monthly source uptime, accuracy, incidents, and governance participation at
`/transparency`.

---

## How to Report Issues

1. **Search first** — check [open issues](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/issues)
   and [closed issues](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/issues?q=is%3Aclosed)
   to avoid duplicates.

2. **Use the issue template** — fill in every section. The minimum useful report includes:
   - What you expected to happen
   - What actually happened
   - Steps to reproduce
   - Browser, OS, and app version

3. **Security vulnerabilities** — do **not** open a public issue. Instead, use GitHub's
   [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
   or email the maintainers directly.

---

## How to Request Features

1. Check the [open issues](https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/issues)
   first — the feature may already be planned.

2. Open a **Feature Request** issue using the template. Describe:
   - The problem the feature solves
   - The proposed solution (or leave it open if you just have the problem)
   - Alternatives you considered

3. Wait for maintainer acknowledgement before starting significant work. A large PR
   without prior alignment may not be merged.

---

## Development Setup

### Prerequisites

| Tool    | Minimum version |
| ------- | --------------- |
| Node.js | 22 (matches CI) |
| npm     | 10              |
| Git     | 2.40            |

### First-time setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-fork>/Stellar-Unified-Price-Oracle-Frontend-.git
cd Stellar-Unified-Price-Oracle-Frontend-

# 2. Install dependencies (exact lockfile versions)
npm ci

# 3. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set VITE_API_URL and VITE_WS_URL

# 4. Start the dev server
npm run dev
# → http://localhost:5173
```

The dev server proxies `/api` and `/ws` to `localhost:3000` (the aggregator API).
To run without the backend, enable MSW mocks:

```bash
VITE_USE_MOCK=true npm run dev
```

### Useful commands

```bash
npm run dev           # Start Vite dev server with HMR
npm run build         # Type-check + production build
npm run typecheck     # TypeScript check only (no emit)
npm run lint          # ESLint
npm run format        # Prettier (writes)
npm run format:check  # Prettier (read-only, CI mode)
npm run test          # Vitest in watch mode
npm run test:run      # Vitest once (CI mode)
npm run test:e2e      # Playwright E2E (needs built dist/)
```

### Git hooks

Husky runs a `pre-push` hook that executes `npm run build && npm run test:run`.
The push is aborted if either fails. This ensures broken builds never reach the
remote. Do not use `--no-verify` to bypass hooks unless you have a very good reason
and have documented it in the PR.

---

## Branch Naming & Commit Messages

### Branch names

```
<type>/<short-description>

fix/alert-threshold-validation
feat/csv-export-progress
docs/storage-security-audit
chore/update-recharts-4
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`.

Branch off `main`. Keep branches short-lived — aim to merge within a week of opening.

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Examples:

```
feat(alerts): add percentage-change threshold mode

fix(connection-badge): show retry count on reconnecting state

docs(storage): add security audit and clear-data utility

chore(deps): pin @tanstack/react-query to 5.62.7
```

Rules:

- Subject line ≤ 72 characters, imperative mood ("add", not "added" / "adds").
- Body wraps at 80 characters.
- Reference issues with `Closes #123` or `Refs #456` in the footer.
- One logical change per commit. Do not bundle unrelated fixes.

### Signed commits

Please sign your commits (SSH or GPG) so history is independently verifiable — see
[`docs/PROVENANCE.md`](./docs/PROVENANCE.md) for setup steps. Release artifacts built
from `main` carry a signed SLSA build provenance attestation; signed commits give the
same guarantee for the source history that produced them.

---

## Pull Request Workflow

1. **Create a branch** off `main` following the naming convention above.

2. **Make your changes** — see coding standards and testing requirements below.

3. **Verify locally** before pushing:

   ```bash
   npm run typecheck   # zero errors
   npm run lint        # zero warnings
   npm run build       # build succeeds
   npm run test:run    # all tests pass
   ```

4. **Push and open a PR** against `main`. PR title follows the same format as
   commit messages. Keep the title under 70 characters.

5. **Fill in the PR description**:
   - Summary of what changed and why
   - What was tested (manual steps, automated tests)
   - Any follow-up issues or known limitations
   - Screenshots / recordings for UI changes

6. **Request a review** from at least one maintainer. For larger changes, two
   reviewers are preferred.

7. **Address review feedback** by pushing new commits (do not force-push after
   review begins). Resolve comment threads explicitly once addressed.

8. **Merging**: use **Squash and merge** for feature/fix branches to keep the `main`
   history linear. The squash commit message must follow Conventional Commits.

### Draft PRs

Open a Draft PR early when you want feedback on direction before the work is done.
Mark it ready for review only when all checks pass and the PR checklist is complete.

---

## Coding Standards

Enforced by ESLint and Prettier. Run `npm run lint && npm run format:check` before
pushing. The pre-push hook will catch remaining issues.

### TypeScript

- Strict mode is enabled — `noImplicitAny`, `strictNullChecks`, and
  `noUnusedLocals` are all on. Do not use `any`; prefer `unknown` plus narrowing.
- Export explicit types for anything crossing a module boundary.
- Prefer `type` for unions/aliases and `interface` for object shapes that may be
  extended.

### React

- Function components only. No class components.
- Keep components small and focused; extract hooks for reusable stateful logic.
- Co-locate tests next to the component (`Component.test.tsx`).
- Use the existing design tokens and Tailwind utilities — do not introduce ad-hoc
  colors or spacing values.

### Imports

- Use the `@/` path alias for `src/` imports.
- Group imports: external packages, then internal modules, then relative imports.

---

## Testing Requirements

- Every bug fix must include a regression test.
- New features must include unit tests for logic and, where user-facing, a component
  test.
- E2E tests are required for critical flows (price display, alerts, wallet connect).
- Tests must pass locally before pushing — the pre-push hook enforces this.

---

## Documentation Requirements

- Update the README or relevant `docs/` file when behavior, configuration, or
  public APIs change.
- Add a changeset-style note in the PR description for user-visible changes.
- Keep code comments meaningful — explain *why*, not *what*.

---

## PR Review Checklist

Before requesting review, confirm:

- [ ] Branch is up to date with `main`
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes
- [ ] New/changed behavior is covered by tests
- [ ] Docs updated where needed
- [ ] PR description explains the change and how it was tested
- [ ] No unrelated changes bundled in

---

## Quarterly Major Dependency Upgrade Sweep

Dependabot groups minor and patch bumps automatically, but **major** upgrades for
React, Vite, Recharts, Zod, i18next, and Storybook need planned work because they
carry breaking changes and migration guides. We run a sweep once per quarter.

### Process

1. **Open one tracking issue per quarter** titled
   `chore(deps): Q<N> <YYYY> major dependency upgrade sweep`. The issue lists every
   major that is behind, with an **upgrade owner** assigned to each.
2. **Inventory the majors** — compare `package.json` against the latest majors for
   the tracked packages (React, Vite, Recharts, Zod, i18next, Storybook). Record the
   current version, target major, and any known breaking changes.
3. **Assign an owner** per major. The owner drives the upgrade PR, reads the upstream
   migration guide, and updates tests/docs.
4. **Land upgrades incrementally** — one PR per major, following the normal PR
   workflow. Do not bundle multiple majors in a single PR.
5. **Close the tracking issue** once every listed major is upgraded or explicitly
   deferred with a rationale and a follow-up issue.

### First sweep — Q1 2025

Tracking issue: `chore(deps): Q1 2025 major dependency upgrade sweep`.

| Package   | Current major | Target major | Owner            | Notes |
| --------- | ------------- | ------------ | ---------------- | ----- |
| React     | 18            | 19           | @frontend-lead   | React 19 removes legacy APIs; verify `react-dom` and testing-library compatibility. |
| Vite      | 5             | 6            | @build-owner     | Vite 6 changes the environment API; check plugins and `vite.config.ts`. |
| Recharts  | 2             | 3            | @charts-owner    | Recharts 3 reworks chart internals; audit price chart components. |
| Zod       | 3             | 4            | @validation-owner| Zod 4 changes error formatting; update schema error handling. |
| i18next   | 23            | 24           | @i18n-owner      | i18next 24 updates plugin APIs; verify locale loading. |
| Storybook | 8             | 9            | @dx-owner        | Storybook 9 consolidates addons; update `.storybook/` config. |

Owners are responsible for opening the upgrade PR for their package and linking it
back to the quarterly tracking issue.
