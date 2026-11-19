# Confidence Calibration

Confidence is a 0–1 value attached to each aggregate and surfaced to users in the UI and in filters. It is only meaningful if it is *calibrated*: a reported confidence of `0.9` must correspond to a lower realized error than a reported confidence of `0.5`.

## What confidence means operationally

A reported confidence of `c` is an estimate of the probability that the aggregate is within the reference tolerance of the reference value (#new). In other words, among all aggregates reported at confidence `c`, roughly `c` of them should agree with the reference oracle. Confidence is therefore a *probability of correctness*, not a measure of sample size, recency, or source count — those inputs feed the confidence model, but the output is the calibrated probability.

## Calibration study

The calibration study buckets historical aggregates by their reported confidence and measures realized error against the reference oracle (#new):

1. Collect historical aggregates that have a reference value available.
2. Bucket them by reported confidence (e.g. deciles: `[0.0, 0.1)`, `[0.1, 0.2)`, …).
3. For each bucket, compute the realized error rate (fraction outside the reference tolerance) and the mean reported confidence.
4. Plot the reliability curve: mean reported confidence (x-axis) against realized accuracy (y-axis). A perfectly calibrated model lies on the diagonal `y = x`.

## Monotonicity check

The reliability curve must be monotonic: higher reported confidence must imply lower realized error. Formally, for any two confidence buckets `a < b`, the realized error rate of `a` must be greater than or equal to the realized error rate of `b` (within the configured tolerance). This check is enforced in CI; a calibration regression beyond the bound fails the build.

## Calibration mapping

If the reliability curve deviates from the diagonal, a calibration mapping is derived from the historical buckets and applied to raw model output before it is reported. The mapping is monotonic by construction so the monotonicity check continues to hold after calibration.

## CI gate

Confidence-model changes are gated against calibration bounds in CI. The gate recomputes the reliability curve from history and fails if:

- the monotonicity check is violated, or
- the calibration error (e.g. expected calibration error) exceeds the configured bound.

## Visual regression gate (locales and color themes)

Visual regressions are gated across every supported locale and color theme so that layout, typography, and color-token changes cannot silently break a locale or theme that is not exercised by the default snapshot run.

### Matrix

The gate renders each covered screen once per combination of:

- **Locale** — every locale listed in the app's supported-locales configuration (the same source the UI uses to build its language switcher).
- **Color theme** — every theme exposed by the design tokens (e.g. light, dark, and any high-contrast variants).

Screens are rendered with the existing frontend state and design tokens; no upstream data is fabricated. Where a screen depends on live oracle data, the gate uses the same fixtures/mocks as the component tests and asserts the explicit loading, empty, stale/unavailable, and error states rather than inventing values.

### What is compared

- Snapshots are captured per `(screen, locale, theme)` cell and compared against committed baselines.
- Locale coverage includes right-to-left and long-string locales so text expansion and directionality regressions are caught.
- Theme coverage asserts that color tokens resolve for each theme; a missing token fails the cell rather than falling back silently.

### Failure behavior

A cell that differs beyond the configured pixel threshold fails the gate and reports the `(screen, locale, theme)` triple so the regression can be localized. Baselines are updated intentionally (never auto-accepted) when a change is expected.

### Accessibility

Visual gating complements, but does not replace, the keyboard and screen-reader coverage described in `docs/ACCESSIBILITY.md`. Interactive states (focus, hover, disabled) are captured in the matrix so focus indicators remain visible across every theme.

### Dependencies

If a new locale or theme is added, it must be registered in the supported-locales/theme configuration so the gate picks it up automatically. Any required API/contract change to expose a new theme or locale is documented as a dependency before the gate is extended.
