# ADR-001: React + Vite + TypeScript

- **Status:** accepted
- **Date:** 2024-01-01

## Context

We need a UI framework and build toolchain for the Stellar Unified Price Oracle dashboard. The dashboard must handle real-time data, render efficiently under frequent price updates, and be maintainable by a small team. The project needs fast iteration cycles during development.

## Decision

Use **React 19** as the UI framework, **Vite 6** as the build tool, and **TypeScript** for static typing across the entire codebase.

- React's component model maps naturally to the card-based price grid.
- Vite's native ESM dev server gives near-instant HMR during development.
- TypeScript catches interface mismatches between the API layer, context, and components at compile time rather than at runtime.

## Consequences

**Easier:**
- Large ecosystem of libraries (React Router, Recharts, Testing Library) works out of the box.
- Vite's build produces optimised, tree-shaken bundles with built-in code splitting.
- TypeScript surface types serve as lightweight documentation for component props and API responses.

**Harder:**
- React's concurrent renderer adds complexity when reasoning about render order for optimistic WebSocket updates.
- TypeScript compilation adds a build step and requires type definitions for every third-party dependency.
