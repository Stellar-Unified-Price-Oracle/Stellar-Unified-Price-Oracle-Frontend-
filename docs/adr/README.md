# Architecture Decision Records (ADRs)

Architecture Decision Records (ADRs) document important technical decisions, the context that led to them, and their trade-offs. This helps new contributors understand the system quickly without having to read all source files.

## Quick Reference

| ADR | Title | Status | Topic |
|-----|-------|--------|-------|
| [ADR-001](./ADR-001-state-management.md) | State Management Approach | Accepted | React Context + Zustand hybrid, low-frequency vs. high-frequency updates |
| [ADR-002](./ADR-002-data-fetching.md) | Data Fetching Strategy | Accepted | WebSocket + REST polling, optimistic updates, deduplication, rate limiting |
| [ADR-003](./ADR-003-component-architecture.md) | Component Architecture | Accepted | Functional components, memoization conventions, composition layers |

## How These Decisions Connect

```
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend Application                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Data Sources (ADR-002)                                          │
│  ├─ WebSocket (real-time prices)  ──┐                           │
│  ├─ REST API (fallback polling)     ├──→ PriceContext (ADR-001) │
│  └─ IndexedDB (caching)            ──┘                          │
│                                          ↓                      │
│  State Management (ADR-001)              │                      │
│  ├─ PriceContext ──────────────────────┘                        │
│  ├─ priceStore (Zustand) ─────────────────────┐                │
│  ├─ PreferencesContext                        │                │
│  └─ Component State (useState)                │                │
│                                              ↓                 │
│  Component Architecture (ADR-003)            │                 │
│  ├─ Pages (fetch data, manage state) ←───────┤                │
│  ├─ Containers (coordinate children)         │                │
│  ├─ Presentational (reusable, memoized)      │                │
│  └─ Layout (structural)                      │                │
│                                              ↓                 │
│  Rendering                                    │                │
│  ├─ Real-time dashboard with smooth animation                 │
│  └─ Mobile-responsive with virtualized lists                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Reading Guide for Contributors

### New to the project?

1. Start here: [ADR-001 State Management](./ADR-001-state-management.md)
   - Learn the three layers: Context, Zustand stores, component state
   - Understand why high-frequency updates use Zustand

2. Then: [ADR-002 Data Fetching](./ADR-002-data-fetching.md)
   - See how WebSocket fast path + REST fallback works
   - Understand optimistic updates and revalidation
   - Learn about rate limiting and request deduplication

3. Finally: [ADR-003 Component Architecture](./ADR-003-component-architecture.md)
   - Learn the memoization convention (the most important rule)
   - See how composition layers work
   - Find the component structure template

### Adding a new feature?

1. Check [ADR-001](./ADR-001-state-management.md): Where does your data live?
   - Component state? Context? Zustand store?

2. Check [ADR-002](./ADR-002-data-fetching.md): How do you get the data?
   - REST endpoint? WebSocket subscription? Cached from IndexedDB?

3. Check [ADR-003](./ADR-003-component-architecture.md): How do you render it?
   - Which composition layer? Memoize? Virtualize lists?

### Debugging performance?

1. Read [ADR-003 Component Architecture](./ADR-003-component-architecture.md)
   - Section: "Principle 2: Memoization Convention"
   - Check if list items are memoized
   - Check if callbacks to memoized children are stable

2. Use React DevTools Profiler to identify which components re-render
   - `npm run dev` → Open DevTools → React tab → Profiler
   - Record an interaction, look for unnecessary re-renders

3. Check [ADR-002 Data Fetching](./ADR-002-data-fetching.md)
   - Section: "Performance Characteristics"
   - Is your feature doing duplicate network requests?
   - Are rate limits being hit?

## Related Documentation

- **[AGENTS.md](../../AGENTS.md)** — Style conventions, memoization gotchas, storage patterns
- **[README.md](../../README.md)** — Quick start, feature overview
- **[CONTRIBUTING.md](../../CONTRIBUTING.md)** — Development workflow, testing
- **[docs/](../)** — Deployment, storage security, environment setup

## Common Questions

### What's the difference between Context and Zustand?

| Aspect | Context | Zustand |
|--------|---------|---------|
| **Update frequency** | Low (every few seconds) | High (10+/sec) |
| **Re-render scope** | All descendants | Only subscribers |
| **Persistence** | Manual | Optional built-in |
| **Debugging** | React DevTools | Zustand DevTools |
| **Use cases** | REST data, preferences | WebSocket prices, connection status |

**Rule of thumb**: If data changes more than once per second, use Zustand. Otherwise, use Context.

### Should I use TanStack Query or useSwr?

| Use Case | Tool |
|----------|------|
| REST endpoints with polling | TanStack Query (via PriceContext) |
| Simple cache-first fetches | useSwr |
| WebSocket updates | priceStore (Zustand) |
| Complex sync logic | useIndexedDB |

### How do I avoid re-render loops?

See [ADR-003: Principle 2 Memoization Convention](./ADR-003-component-architecture.md#principle-2-memoization-convention).

**TL;DR**: Memoize list items and callbacks passed to memoized children.

### What's the performance budget?

From README.md:

| Asset | Limit | Status |
|-------|-------|--------|
| JavaScript (entry) | 200 kB | Enforced in CI |
| CSS | 50 kB | Enforced in CI |

Check with `npm run size-limit`.

## How to Propose a New ADR

If you're making an architectural decision that affects the codebase:

1. Create a new file: `docs/adr/ADR-NNN-[title].md`
2. Use the template below
3. Open a pull request with `[ADR]` prefix
4. Link it from this README

### ADR Template

```markdown
# ADR-NNN: [Decision Title]

## Status

Proposed / Accepted / Deprecated

## Context

What's the problem? Why does this matter?

## Decision

What did you decide? What are the alternatives you considered?

## Implementation

How do you do this in practice? Code examples?

## Trade-Offs

What are the benefits and drawbacks?

## Rationale

Why this decision over alternatives?

## Related Decisions

Links to other ADRs.

## Further Reading

External links, papers, documentation.
```

## Questions?

- **Confusion about state management?** → [ADR-001](./ADR-001-state-management.md)
- **Network issues or data flow?** → [ADR-002](./ADR-002-data-fetching.md)
- **Component or rendering problems?** → [ADR-003](./ADR-003-component-architecture.md)
- **Still stuck?** → Check [CONTRIBUTING.md](../../CONTRIBUTING.md) or open an issue

---

**Last updated:** 2026-08-26
**Maintainers:** Stellar Unified Price Oracle Team
