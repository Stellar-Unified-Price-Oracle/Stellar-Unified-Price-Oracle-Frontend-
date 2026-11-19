# Analytics & Observability

This document describes the frontend observability tooling for the Stellar
price-oracle frontend. It covers analytics events, validation hardening, the
health checklist, rollback verification, and the memory-growth profiling
workflow introduced for issue #871.

## Analytics events

Analytics events are emitted through the existing frontend analytics helper and
reuse the current API contracts. No upstream data is fabricated; any event that
requires a new backend field is documented below as a dependency.

## Memory-growth profiling (#871)

Repeatedly changing trading pairs and chart ranges can leak memory (chart
instances, subscriptions, cached series). The profiling workflow below measures
heap growth across repeated pair/range cycles so regressions are caught early.

### What it measures

- **Heap usage delta** across N cycles of pair + chart-range changes.
- **Per-cycle growth** to distinguish steady-state churn from a true leak.
- **Retained growth** after returning to the initial pair/range.

### How to run

1. Open the app in a Chromium-based browser with DevTools.
2. Open the **Memory** panel and take a baseline heap snapshot.
3. Cycle through pairs and chart ranges repeatedly (e.g. 20 cycles).
4. Force garbage collection, then take a second heap snapshot.
5. Compare snapshots and record the retained delta.

A healthy run returns close to the baseline after GC. Sustained growth that
scales with the number of cycles indicates a leak in chart or subscription
lifecycle handling.

### States to verify

While profiling, confirm the UI handles each state explicitly:

- **Loading** — chart/pair data is being fetched.
- **Empty** — no data available for the selected pair/range.
- **Stale / unavailable** — upstream data is old or missing; the UI must say so
  rather than showing fabricated values.
- **Error** — fetch or contract errors surface a clear, accessible message.

### Accessibility

Interactive controls (pair selector, range selector) must remain keyboard
operable and expose labels/roles to screen readers. Verify with keyboard-only
navigation and a screen reader before signing off a profiling run.

## Dependencies

If profiling reveals that a backend/contract change is required (for example, a
new field to distinguish stale from unavailable data), document it here as a
dependency rather than fabricating upstream data in the frontend.

## Post-release health checklist (#873)

Run this checklist after every release. Each item pairs a user-facing behavior
with a **measurable frontend signal** so a release can be signed off with
objective evidence rather than a subjective glance. Signals reuse existing
frontend state, components, design tokens, and API contracts; no upstream data
is fabricated.

### Measurable signals

| Signal | How to measure | Healthy threshold |
| --- | --- | --- |
| Analytics coverage | Count `pair_change` / `range_change` events in the analytics debug log while exercising both selectors. | 1 event per interaction, 0 dropped |
| State coverage | Walk each pair/range through loading → empty → stale/unavailable → error and confirm a distinct, labeled UI state. | 4/4 states render explicitly |
| Stale/unavailable honesty | Confirm stale or missing upstream data shows an explicit message, never a fabricated price. | 0 fabricated values |
| Accessibility | Keyboard-only pass plus screen-reader pass over the pair and range selectors. | All controls reachable, labeled, and operable |
| Memory retention | Follow the profiling workflow above; record retained delta after GC. | No retained growth scaling with cycles |
| Rollback readiness | Verify the previous release can be restored and the checklist re-run against it. | Rollback path verified |

### Checklist

- [ ] Analytics events fire for pair and range changes (1 per interaction).
- [ ] Loading, empty, stale/unavailable, and error states render correctly and
      are distinguishable to assistive tech.
- [ ] Stale or unavailable data is labeled explicitly; no fabricated values.
- [ ] Keyboard and screen-reader behavior verified for selectors.
- [ ] Memory profiling run shows no retained growth after GC.
- [ ] Rollback path verified against the previous release.

### Dependencies

If a signal cannot be measured with the current API contract (for example, no
field distinguishes stale from unavailable data), record it here as a
dependency and resolve it upstream rather than approximating in the frontend.
