# ADR-004: Tailwind CSS for Styling

- **Status:** accepted
- **Date:** 2024-01-01

## Context

The dashboard is a monitoring UI with a dark-theme-first design. Styling needs to be fast to write, easy to co-locate with components, and produce small production CSS. The team is small, so a design system with many custom abstractions would be premature.

Options considered:

- **CSS Modules** — scoped styles, no runtime, but verbose for utility patterns.
- **CSS-in-JS** (e.g. styled-components) — runtime overhead, poor for a performance-sensitive dashboard.
- **Tailwind CSS** — utility-first, zero runtime, integrates with Vite via the official plugin.

## Decision

Use **Tailwind CSS v4** via `@tailwindcss/vite`, integrated directly into the Vite build pipeline.

All component styles are written as utility class strings inside JSX. No custom CSS files beyond `src/index.css` (which contains the Tailwind directives). Dark-mode variants (`dark:`) are used extensively as the UI is dark-first.

## Consequences

**Easier:**
- No context switching between JSX and CSS files for routine styling.
- Tailwind's JIT compiler emits only the classes actually used, keeping CSS bundle size well below the 50 kB budget.
- Responsive and dark-mode variants are available without writing any media queries.

**Harder:**
- Long class strings inside JSX can become hard to read without IDE assistance or Prettier formatting.
- Deviating from Tailwind's default scale (e.g. custom colours, spacing tokens) requires extending the config rather than writing one-off CSS rules.
- Developers unfamiliar with utility-first CSS face a learning curve.
