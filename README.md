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

- the monotonicity check is violated, or
- the calibration error (e.g. expected calibration error) exceeds the configured bound.

## Handsoff notes

<!-- handsoff-issue-956 -->
- #956: [Stabilize] perf/mobileBenchmarks.ts fixture no longer matches the operator disclosure type

<!-- handsoff-issue-957 -->
- #957: [Stabilize] WebSocketClient no longer calls message handlers and drops sequence-ordering
