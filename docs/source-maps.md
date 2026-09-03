# Source Map Strategy

## Overview

Source maps let engineers read meaningful stack traces in production errors without
exposing original source code to end-users.  This document describes how source maps
are generated, where they are sent, and how they are kept off the public CDN.

## Configuration

### Vite (`vite.config.ts`)

| Mode | Setting | Effect |
|------|---------|--------|
| `development` | `sourcemap: true` | Inline source maps — fast rebuilds, full DevTools support |
| `production` | `sourcemap: 'hidden'` | Separate `.map` files, **no** `//# sourceMappingURL` comment in the JS bundle |

`'hidden'` means Rollup writes `dist/assets/*.js.map` files alongside the JS chunks
but does **not** append a `sourceMappingURL` reference to the JS.  Browsers will not
try to load them; the error-tracking service uses them server-side.

### TypeScript (`tsconfig.app.json`)

The app TypeScript config uses `noEmit: true` so TypeScript does not produce any
output files — Vite/Rollup handles transpilation.  Declaration maps (`declarationMap`)
are therefore not applicable for this application target.

## CI Pipeline (`.github/workflows/ci.yml`)

After the build step the pipeline runs two additional steps:

1. **Upload to Sentry** (main branch only, when `SENTRY_AUTH_TOKEN` secret is set)
   ```
   npx @sentry/cli sourcemaps upload --org <org> --project <project> dist/assets
   ```
   This registers each `.map` file against its release so Sentry can un-minify frames.

2. **Strip from artifact**
   ```
   find dist/assets -name '*.map' -delete
   ```
   Removes every `.map` file before the `dist/` directory is uploaded as a CI artifact
   and before it would be deployed.  End-users and the CDN never see `.map` files.

## Required CI Secrets

| Secret | Description |
|--------|-------------|
| `SENTRY_AUTH_TOKEN` | API token with `project:releases` scope |
| `SENTRY_ORG` | Sentry organisation slug |
| `SENTRY_PROJECT` | Sentry project slug |

The upload step is skipped silently if `SENTRY_AUTH_TOKEN` is absent, so the pipeline
works for forks and contributors who have not configured Sentry.

## Verifying Source Maps in DevTools

During local development (`npm run dev`) source maps are inline — open Chrome/Firefox
DevTools → Sources panel and the original TypeScript files appear directly.

For a local production build:

```bash
npm run build          # produces dist/assets/*.js.map
npm run preview        # serve dist/
```

Open DevTools → Sources → `localhost:4173` and the original source tree is visible
because the local preview still has the `.map` files (the strip step only runs in CI).

## Security Considerations

- `.map` files are never committed to the repository.
- The `.gitignore` already excludes `dist/`.
- Source maps uploaded to Sentry are only accessible to authenticated members of the
  Sentry organisation.
- No original source code is embedded in the deployed JS bundles.
