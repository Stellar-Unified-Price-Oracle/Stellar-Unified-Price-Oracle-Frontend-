# Analytics & Performance Metrics

This document describes the client-side metrics the Stellar price-oracle
frontend records. All metrics are collected locally in the browser; no
upstream API or contract change is required to emit them.

## Why "time to useful price panel"

Initial page paint (FCP/LCP) does not tell us whether a user actually saw a
usable price. The price panel can paint a skeleton, then wait on the oracle
fetch before it shows a real price. We therefore measure the moment the panel
first renders **useful** data, not just the moment the page paints.

## Metric definitions

| Metric | Meaning |
| --- | --- |
| `price_panel_paint` | Timestamp when the price panel first mounts (skeleton visible). |
| `price_panel_useful` | Timestamp when the panel first renders a non-empty, non-stale price for the selected asset. |
| `time_to_useful_price_panel` | `price_panel_useful - navigationStart`. This is the headline metric. |
| `price_panel_state` | Terminal state observed: `useful`, `empty`, `stale`, `unavailable`, or `error`. |

### What counts as "useful"

A price panel is useful when **all** of the following hold:

- A price value is present (not a placeholder/skeleton).
- The data is not flagged stale (see staleness rules below).
- The panel is not in an error or unavailable state.

Empty, stale, unavailable, and error states are recorded with their own
`price_panel_state` value so we can distinguish "slow" from "broken".

### Staleness

A price is considered stale when its timestamp is older than the configured
freshness window. Stale data is still shown to the user (with a visible stale
indicator) but does **not** count toward `time_to_useful_price_panel`.

## Emission

- The metric is emitted once per page load, on the first transition into the
  `useful` state. Subsequent refreshes do not re-emit it.
- If the panel never reaches `useful` (empty/unavailable/error), the metric is
  emitted with the corresponding `price_panel_state` and no duration, so the
  failure is still observable.
- Metrics are best-effort and must never block rendering or throw.

## Accessibility

State transitions that affect the metric (loading → useful, loading → error,
loading → stale) are also reflected in the panel's accessible status region so
screen-reader users receive the same information sighted users get from the
visual state.

## Dependencies

No API or contract changes are required. If a future upstream change adds a
server-provided freshness timestamp, the staleness rule above should be
revisited; until then freshness is derived from the client receive time.
