# Quarterly Major Dependency Upgrade Sweep

This document describes the recurring process for planning and executing **major**
dependency upgrades. Dependabot already groups minor and patch updates; majors
require planned work because they often include breaking changes, migration
steps, and coordinated code changes.

## Cadence

- One sweep per quarter (Q1, Q2, Q3, Q4).
- At the start of each quarter, open a single tracking issue titled
  `[Dependency sweep] <YYYY> Q<n> major upgrades`.
- The tracking issue lists every major that is behind, the current and target
  versions, and a named upgrade owner for each item.
- The sweep is considered done when every listed major is either upgraded and
  merged, or explicitly deferred with a written reason in the tracking issue.

## Tracking issue template

```markdown
## Quarterly major dependency sweep — <YYYY> Q<n>

| Package | Current | Latest major | Owner | Status |
| ------- | ------- | ------------ | ----- | ------ |
| react   | x.y.z   | a.b.c        | @user | todo   |
| vite    | x.y.z   | a.b.c        | @user | todo   |
| recharts| x.y.z   | a.b.c        | @user | todo   |
| zod     | x.y.z   | a.b.c        | @user | todo   |
| i18next | x.y.z   | a.b.c        | @user | todo   |
| storybook | x.y.z | a.b.c        | @user | todo   |

### Notes
- Breaking changes / migration guides:
- Deferred items and reasons:
```

## Process

1. **Inventory** — run `npm outdated` (or equivalent) and collect the majors
   that are behind for the tracked packages: React, Vite, Recharts, Zod,
   i18next, and Storybook.
2. **Open the tracking issue** — one issue per quarter using the template above,
   with an owner assigned to each major.
3. **Plan** — for each major, read the upstream migration guide, note breaking
   changes, and estimate the work. Split large upgrades into their own PRs.
4. **Execute** — upgrade one major at a time, keep PRs focused, and verify with
   the existing build and test suite.
5. **Close out** — update the tracking issue statuses and record any deferrals
   with reasons before the quarter ends.

## First sweep

Tracking issue: `[Dependency sweep] <YYYY> Q<n> major upgrades` (link the issue
here once opened). The first sweep records the majors that are behind for React,
Vite, Recharts, Zod, i18next, and Storybook, each with a named upgrade owner, and
is closed out following the process above.
