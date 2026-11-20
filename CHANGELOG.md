# Changelog

All notable changes to this project are documented in this file.

## Dependency upgrade process

### Quarterly major-dependency upgrade sweep

Dependabot keeps minor and patch dependencies current through grouped updates. Major upgrades are handled separately because they can require code changes, migration steps, and coordinated testing.

Process:

1. **Cadence** — Run one sweep per quarter (Q1–Q4).
2. **Tracking issue** — At the start of each quarter, open a single tracking issue titled `[Dependency sweep] <YYYY> Q<n> major upgrades`.
3. **Inventory** — In that issue, list every major dependency that is behind, including the current version, the latest major, and any known breaking changes or migration notes.
4. **Owner** — Assign an upgrade owner to each listed major. The owner is responsible for the upgrade PR, migration notes, and verification.
5. **Execution** — Upgrade one major at a time in its own PR, referencing the tracking issue. Run the full test suite and smoke-test affected areas before merging.
6. **Close-out** — When all listed majors are upgraded (or explicitly deferred with a reason), close the tracking issue and record the outcome below.

### First sweep

Tracking issue: `[Dependency sweep] major upgrades — first sweep`

| Dependency | Area | Status | Upgrade owner |
| --- | --- | --- | --- |
| React | UI runtime | Behind — major upgrade pending | TBD |
| Vite | Build tooling | Behind — major upgrade pending | TBD |
| Recharts | Charts | Behind — major upgrade pending | TBD |
| Zod | Validation | Behind — major upgrade pending | TBD |
| i18next | Internationalization | Behind — major upgrade pending | TBD |
| Storybook | Component docs/testing | Behind — major upgrade pending | TBD |

Each owner should open a dedicated upgrade PR against the tracking issue, note breaking changes and migration steps, and confirm the test suite passes before merge.
