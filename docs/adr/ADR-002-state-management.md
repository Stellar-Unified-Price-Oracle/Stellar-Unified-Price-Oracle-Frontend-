# ADR-002: State Management Strategy

- **Status:** accepted
- **Date:** 2024-01-01

## Context

The dashboard needs two distinct kinds of state:

1. **Server state** — paginated price snapshots fetched via REST, needs caching and background revalidation.
2. **Real-time state** — live price updates pushed over WebSocket, needs optimistic application and REST-based confirmation.

We also need lightweight cross-cutting state for UI panels (alerts, sidebar) that must be reachable from many components without prop drilling.

## Decision

Use **React Context** for cross-cutting state with two providers:

- `PriceProvider` — owns WebSocket lifecycle, live price map, REST polling via a custom `useSwr` hook, and pair subscription management.
- `AlertsProvider` — owns alert CRUD, `localStorage` persistence, and real-time threshold evaluation against live prices.

Write a minimal `useSwr` hook internally instead of pulling in SWR or React Query, keeping the bundle small and the retry/caching behaviour fully under our control.

No external state management library (Redux, Zustand, Jotai) is added at this time.

## Consequences

**Easier:**
- Zero extra runtime dependencies for state management.
- `useSwr` retry and caching logic is transparent and fully testable.
- Context consumers re-render only when their slice of context changes.

**Harder:**
- Context updates re-render every consumer — high-frequency WebSocket ticks hitting `PriceContext` may cause unnecessary renders in deeply nested consumers; `memo` must be applied at component boundaries.
- As the app grows, multiple nested providers may become difficult to track. Migration to a dedicated library would require refactoring context consumers.
