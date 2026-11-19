# Stellar Price Oracle Frontend

A frontend for the Stellar price oracle. This document covers local development,
release operations, and the rollback verification path for frontend releases.

## Getting started

```bash
npm install
npm run dev
```

Build and preview a production bundle:

```bash
npm run build
npm run preview
```

## Rollback verification path

Frontend releases are static bundles. A rollback means re-deploying a previously
known-good build artifact. Because the API/contract layer is shared across
releases, a rollback only reverts the frontend — it does **not** revert upstream
data. Verify the deployed build identity and the live data states after every
rollback.

### 1. Pre-rollback capture

Before rolling back, record the current state so you can compare and, if needed,
roll forward again.

- [ ] Capture the currently deployed build identity (see *Build identity* below)
      and store it in the incident ticket.
- [ ] Capture the failing release's build identity and the exact symptom
      (route, error text, screenshot).
- [ ] Note the target known-good build identity you intend to restore.
- [ ] Confirm the target artifact still exists in the artifact store / CDN.

### 2. Rollback execution

- [ ] Re-deploy the target known-good artifact (do not rebuild from a moving
      branch; deploy the exact captured artifact).
- [ ] Wait for the CDN/deploy to report success.
- [ ] Do not clear caches manually unless the verification step shows stale
      assets (see *Stale/unavailable* below).

### 3. Post-rollback verification

Run the checklist script (see *Verification script*) or perform these checks
manually:

- [ ] **Build identity** matches the target known-good build (see below).
- [ ] **Health**: the app shell loads and the primary route renders.
- [ ] **Key routes** load without console errors: the price list, an individual
      asset/price detail view, and any settings/about route.
- [ ] **Data states** behave correctly (see *Data states* below).
- [ ] **Accessibility**: keyboard navigation reaches primary controls and the
      page has a sensible focus order (see `docs/ACCESSIBILITY.md`).

### 4. Rollback-of-rollback (roll forward)

If the rollback introduces a new problem:

- [ ] Re-deploy the previously captured build identity from step 1.
- [ ] Re-run the post-rollback verification against that identity.
- [ ] Record both identities and outcomes in the incident ticket so the next
      operator has a clear history.

## Build identity

Operators must be able to confirm *which* release is live. The deployed bundle
should expose a build identity (a build hash/version string baked in at build
time, or an asset manifest served alongside the app).

- [ ] Confirm the live build identity equals the intended target identity.
- [ ] If the identity cannot be read (endpoint missing, manifest 404), treat the
      deployment as **unverified** and do not declare the rollback complete.

> Dependency note: if the app does not yet expose a build identity endpoint or
> asset manifest, that is a required upstream/build change — do not fabricate a
> version value. Track it as a dependency and fall back to comparing the
> deployed asset filenames against the captured artifact.

## Data states

During verification, confirm the UI handles each state explicitly rather than
showing fabricated or misleading data:

- **Loading**: skeleton/spinner is shown; no stale values are presented as fresh.
- **Empty**: a clear empty state is shown when there is no data.
- **Stale/unavailable**: when the API is unreachable or data is stale, the UI
  surfaces that state (e.g. a stale/unavailable indicator) instead of silently
  showing old values as current.
- **Error**: a recoverable error state with a retry affordance is shown; the
  error is not swallowed.

If the API is unavailable during verification, confirm the unavailable/error
state renders correctly and note it in the ticket — do not treat missing
upstream data as a rollback failure of the frontend itself.

## Verification script

A runnable checklist script lives at `scripts/verify-release.sh`. It checks
health, build identity, and key routes against a target base URL without
fabricating upstream data. Run it after every rollback:

```bash
BASE_URL=https://<deployed-host> EXPECTED_BUILD=<build-id> ./scripts/verify-release.sh
```

See the script header for the full list of checks and exit codes.
