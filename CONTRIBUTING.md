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

---

## Code of Conduct

We follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

**TL;DR**: be respectful, assume good intent, keep criticism technical and constructive.
Harassment, discrimination, and personal attacks have no place here.

If you experience or witness a violation, report it by opening a private discussion
or emailing the maintainers listed in `package.json`. All reports are treated
confidentially. Maintainers are obligated to respond within 72 hours.

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

| Tool | Minimum version |
|------|----------------|
| Node.js | 22 (matches CI) |
| npm | 10 |
| Git | 2.40 |

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

- Strict mode is enabled — `noImplicitAny`, `strictNullChecks`, etc.
- Prefer `type` over `interface` for local prop types; use `interface` for public
  API contracts.
- Never use `any`; use `unknown` and narrow it.
- Export types with `export type` (erasable at compile time).

### React

- Use named exports for all components and hooks.
- Wrap components that re-render frequently with `memo()`.
- Follow the memoization convention in `AGENTS.md`:
  - Use `useCallback` when passing a function to a `memo()` component or into a
    `useEffect` dependency array.
  - Do **not** wrap event handlers on host elements (`onClick` on `<button>`).
- No class components except `ErrorBoundary` (class is required for error boundaries).
- All user-visible strings come from `react-i18next`. No hardcoded English in JSX.

### Styling

- Tailwind utility classes only — no CSS modules, no inline `style` objects.
- Follow the dark-theme-first pattern: default classes target dark backgrounds;
  add `dark:` variants only where the light theme differs.
- No magic numbers in CSS — use Tailwind's scale or CSS variables.

### Storage

- All `localStorage` access goes through `src/utils/storage.ts`.
- No tokens, secrets, or PII in `localStorage` or `IndexedDB`.
- Add new keys to `STORAGE_KEYS` and update `docs/storage-security-audit.md`.

### General

- No semicolons.
- Single quotes for strings.
- 2-space indentation.
- Maximum line length: 100 characters (Prettier default is 100).
- Remove unused imports before committing.

---

## Testing Requirements

Every change to `src/` must be covered by tests unless the change is purely
documentation or styling with no logic.

### Unit tests (Vitest)

- Co-located next to the file under test: `Foo.test.tsx` beside `Foo.tsx`.
- Use `@testing-library/react` for component tests.
- Test behaviour, not implementation — query by role, label, or text rather than
  by CSS class or internal component state.
- Every new utility function needs at least one happy-path test and one error/edge
  case test.
- Run with `npm run test:run` (CI mode) and ensure zero failures.

### Coverage expectations

| Area | Expectation |
|------|------------|
| New utility functions (`src/utils/`) | 100 % branch coverage |
| New hooks (`src/hooks/`) | Happy path + error path |
| New components | Render test, key interactions, empty/error/loading states |
| Bug fixes | Regression test that would have caught the bug |

### E2E tests (Playwright)

E2E tests live in `e2e/`. They run against a production build (`dist/`). Add an
E2E test when:

- You change a critical user flow (price alert creation, export, WebSocket reconnect).
- A bug was only visible in E2E and not in unit tests.

Run locally with:

```bash
npm run build
npm run test:e2e
```

Playwright tests run on Chromium, Firefox, and WebKit in CI.

### Snapshot tests

Snapshot files (`__snapshots__/`) are committed. When a snapshot legitimately
changes (e.g. you changed the component's markup), update it with:

```bash
npx vitest run --update-snapshots
```

Review the diff in the PR to confirm the change is intentional.

---

## Documentation Requirements

| Type of change | Documentation required |
|---------------|----------------------|
| New component | JSDoc file header with `@example`, props table, edge cases, and accessibility notes |
| New hook | JSDoc comment on the exported function with `@param`, `@returns`, and at least one `@example` |
| New utility function | JSDoc comment, parameter descriptions, and error conditions |
| New localStorage key | Add to `STORAGE_KEYS`, update `docs/storage-security-audit.md` |
| Architecture decision | Create `docs/adr/ADR-NNN-short-title.md` using the template in that directory |
| Breaking change | Note in the PR description and update `README.md` if it affects Quick Start |

The component reference lives in `docs/components.md`. Update the props table and
hierarchy diagram when you add or rename a component.

---

## PR Review Checklist

### For PR authors

Before marking your PR ready for review, confirm:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — build succeeds
- [ ] `npm run test:run` — all tests pass
- [ ] New code has tests (see Testing Requirements)
- [ ] New components have JSDoc headers
- [ ] New `localStorage` keys are in `STORAGE_KEYS` and `storage-security-audit.md`
- [ ] No hardcoded English strings (use i18n keys)
- [ ] No direct `localStorage` calls outside `storage.ts`
- [ ] No secrets, tokens, or PII in source or storage
- [ ] PR description has a summary, testing notes, and screenshots (if UI changed)
- [ ] PR title follows Conventional Commits format

### For reviewers

When reviewing a PR, check:

- [ ] The change solves the stated problem without unnecessary scope creep
- [ ] TypeScript types are accurate — no `as any`, no unchecked casts
- [ ] `memo()` / `useCallback` / `useMemo` are used correctly per `AGENTS.md`
- [ ] Error states are handled (network failures, empty data, type mismatches)
- [ ] Accessibility: interactive elements have labels, keyboard paths work, no
      colour-only indicators
- [ ] Tests cover the new behaviour and realistic failure modes
- [ ] Storage changes follow the security policy
- [ ] No new open-range dependencies (`^` / `~`) for security-sensitive packages;
      prefer exact pinning
- [ ] The bundle size budget is not broken (`npm run size-limit`)
