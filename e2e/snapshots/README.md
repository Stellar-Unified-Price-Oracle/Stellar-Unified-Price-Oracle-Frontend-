# Visual Regression Baselines

This directory contains the approved baseline screenshots used by the Playwright
visual regression tests (`e2e/visual-regression.spec.ts`).

## How it works

Screenshots are captured at three viewports (mobile 375×812, tablet 768×1024,
desktop 1440×900) and in both dark and light colour schemes, for the following pages:

- Dashboard (`/`)
- Price Detail (`/prices/BTC%2FUSD`)
- API Docs (`/api-docs`)
- 404 Not Found

The tests compare the current render against these baselines using Playwright's
built-in pixel comparison engine. CI fails if any screenshot differs beyond a
**2 % pixel-ratio** threshold (configurable per-snapshot via `maxDiffPixelRatio`).

## Updating baselines

Run the helper script from the project root:

```sh
npm run test:e2e:visual:update
```

This builds the app (if needed), runs Playwright with `--update-snapshots`, and
prints instructions for reviewing and committing the new screenshots.

After reviewing the diffs in the HTML report:

```sh
git add e2e/snapshots/
git commit -m "chore: update visual regression baselines"
```

## CI behaviour

The `visual-regression` job in `.github/workflows/ci.yml` runs after the build
succeeds. It uploads the Playwright HTML report as the `visual-regression-report`
artifact regardless of outcome, so you can inspect pixel diffs in the GitHub
Actions UI. On failure it also uploads `test-results/` as `visual-regression-diffs`.

The job is marked `continue-on-error: true` so that a screenshot drift on a PR
is visible but does not block the merge gate — the developer must deliberately
update baselines and commit them.
