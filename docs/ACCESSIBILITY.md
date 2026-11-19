# Accessibility

This document describes the accessibility guarantees of the Stellar price-oracle
frontend and the user-facing recovery copy shown for each known API error
category.

## Recovery copy for API error categories

Every API failure surfaced to the user maps to a known category. Each category
has explicit, plain-language recovery copy and an announced live-region message
so screen-reader users receive the same guidance as sighted users.

| Category | Trigger | User-facing recovery copy |
| --- | --- | --- |
| Network | Request could not reach the API (offline, DNS, CORS) | "We couldn't reach the price service. Check your connection and try again." |
| Timeout | Request exceeded the client timeout | "The price service took too long to respond. Please try again." |
| Rate limit | HTTP 429 | "Too many requests. Please wait a moment before refreshing." |
| Auth | HTTP 401 / 403 | "You don't have access to this data. Sign in again or contact your administrator." |
| Not found | HTTP 404 | "We couldn't find prices for that asset. Check the asset code and try again." |
| Validation | HTTP 400 / 422 | "Some of the details look invalid. Review your input and try again." |
| Server error | HTTP 5xx | "The price service is having trouble right now. Please try again shortly." |
| Stale / unavailable | Cached data older than the freshness window, or no data | "Prices may be out of date. Refresh to get the latest values." |

### Behavior notes

- Recovery copy is rendered in a `role="status"` / `role="alert"` live region so
  it is announced without moving focus.
- Stale and unavailable states are explicit: the panel never presents cached
  values as fresh, and the timestamp of the last successful update is shown.
- Retry controls are real `<button>` elements, reachable by keyboard and
  operable with Enter/Space, with an accessible name that includes the action.
- Loading, empty, stale/unavailable, and error states each have distinct copy so
  users are never left without guidance.

### Dependencies

No upstream API or contract change is required. Categories are derived from the
HTTP status and transport outcome already returned by the existing API client.
If the API later adds structured error codes, the mapping above should be
extended rather than replaced.

## Keyboard and screen-reader coverage

- All interactive controls (refresh, retry, asset selection) are focusable in a
  logical order and expose visible focus styles from the design tokens.
- Live-region updates for loading, stale, and error states are covered by
  component tests asserting the announced text.
- Color is never the sole indicator of state; each state pairs its color with
  text copy from the table above.
