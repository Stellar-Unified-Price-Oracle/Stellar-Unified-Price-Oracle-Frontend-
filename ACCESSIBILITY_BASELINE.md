# Accessibility Baseline Violations Tracker

This document tracks known accessibility violations in the Stellar Unified Price Oracle Frontend that are deferred for future remediation. Selectively disabling these checks in automated tests allows us to catch new violations in CI without breaking on existing design decisions.

## Baseline Violations

### 1. Nested Interactive Controls (`nested-interactive`)

- **Rule ID**: `nested-interactive`
- **Impact**: Serious
- **Description**: Interactive controls (buttons, links) must not be nested within other interactive controls.
- **Affected Components**:
  - `PriceCard` (`src/components/PriceCard.tsx`): The main card is markup-coded as a clickable `role="button"` to navigate to the detail view, but contains nested interactive controls:
    - Drag handle button (`button`)
    - "Set alert" quick-action button (`button`)
  - `PriceTableView` (`src/components/PriceTableView.tsx`): The table rows are clickable `tr` elements with `role="button"`, containing:
    - "Set alert" quick-action button (`button`)
  - `Dashboard` (`src/pages/Dashboard.tsx`): Renders `PriceCard` and `PriceTableView`, inheriting their nested interactive elements.
- **Remediation Plan**:
  - Future iterations should refactor the layout to remove nested clickable elements. For instance, the quick-action buttons can be placed outside the main card/row focus area, or the parent navigation trigger can be implemented using a separate link/button inside the card instead of making the entire card wrapper a button.
  - Until then, the `nested-interactive` rule is disabled in tests for these specific files/states.
