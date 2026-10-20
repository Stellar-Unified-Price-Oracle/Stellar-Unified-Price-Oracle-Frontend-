# Parameter Watch Subscriptions & Change Notifications

## Overview

Stellar Unified Price Oracle tuneable parameters (such as minimum source counts, deviation thresholds, heartbeat timeouts, and reward allocations) dictate oracle reliability and security. Governance participants and protocol integrators need real-time awareness when any watched parameter is updated.

This feature (#852) enables users to subscribe to critical parameters and receive immediate toast alerts and review banners when changes occur.

## Key Features

1. **Parameter Subscriptions (Watch / Unwatch)**:
   - Every parameter row in the Parameter Registry includes an interactive "Watch" / "Watching" button with an accessible bell icon.
   - Subscriptions persist in browser local storage under `stellar_watched_parameters`.

2. **Immediate Change Detection**:
   - Compares latest parameter records against snapshots (`stellar_watched_parameter_snapshots`).
   - Detects changes whenever values update (`currentValue`) or new revisions are recorded (`lastChangedAt`).
   - Initial subscription captures current state without triggering immediate false notifications.

3. **In-App Toast Alerts & Review Banners**:
   - Fires non-intrusive toast alerts via `ToastContext` when updates arrive.
   - Displays an in-page change review banner at the top of the Parameter Registry panel summarizing updated parameters with previous and new values, timestamps, and dismiss options.

4. **Dedicated Filter Views**:
   - Tabbed view toggle between **All parameters ({count})** and **Watched ({watchedCount})**.
   - Accessible empty states guiding users on how to watch parameters if none are currently monitored.

## Architecture

- **`src/utils/parameterNotifications.ts`**: Pure helper functions for snapshot storage, change detection logic, and deduplication.
- **`src/hooks/useWatchedParameters.ts`**: Reusable hook managing watched keys, change detection on data refresh, and toast dispatches.
- **`src/components/ParameterRegistryPanel.tsx`**: Registry UI integrating subscription toggles, filter tabs, and change review alerts.

## API Contracts & Fallback Handling

- **Data Dependency**: Depends on standard `ParameterRecord` objects delivered by `fetchParameterRegistry()`.
- **Unavailable/Stale Data**: Missing or non-reported values render with explicit "not reported" text rather than fabricated defaults.
- **Offline / Storage Fallback**: Gracefully handles disabled or quota-exceeded local storage without disrupting panel rendering.

## Accessibility (a11y)

- Interactive watch buttons use `aria-pressed`, `aria-label`, and `title` tooltips.
- Filter controls use semantic `role="tablist"` and `role="tab"` with `aria-selected`.
- Change review banners announce updates to screen readers via `role="status"` and `aria-label="Watched parameter updates"`.
