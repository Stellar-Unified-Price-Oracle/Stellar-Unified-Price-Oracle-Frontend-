# Lazy Loading Audit

This document tracks how the Stellar price-oracle frontend splits its JavaScript
bundle between the **initial (entry) chunks** that must load before first paint
and the **deferred feature chunks** that are fetched on demand via dynamic
`import()`.

## Bundle budget categories

Bundle budgets are enforced in two independent categories so that a regression in
one does not hide behind headroom in the other:

| Category | What it covers | Failure behavior |
| --- | --- | --- |
| `initial` | Entry chunks required for first render (app shell, router, shared providers, design tokens). | The bundle-size check fails if any initial chunk exceeds its budget. |
| `deferred` | Feature chunks loaded lazily after user interaction or route entry. | The bundle-size check fails if any deferred chunk exceeds its budget. |

Each category is evaluated independently: an over-budget deferred chunk fails the
check even when the initial bundle is within budget, and vice versa. Budget
thresholds live in `budgets.config.json` under the `initial` and `deferred` keys.

## Reporting

Existing bundle-size history and CI reporting are preserved. The check reports
per-category pass/fail results alongside the historical size trend so reviewers
can see which category regressed. No data is fabricated — sizes are measured from
the actual build output.

## Audited lazy-loaded features

- Price oracle dashboard panels
- Historical chart views
- Settings and admin surfaces

When adding a new deferred feature, register it under the `deferred` budget so it
is measured against the correct threshold.
