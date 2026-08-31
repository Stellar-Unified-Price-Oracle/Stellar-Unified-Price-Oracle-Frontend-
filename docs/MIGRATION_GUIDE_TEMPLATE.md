# Migration Guide — vX.0.0

> **Copy this template for every major version bump.**
> File it at `docs/migrations/vX-to-vY.md` and link to it from the GitHub Release notes.

## Overview

Brief one-paragraph description of what changed and why this is a major version.

---

## Breaking Changes

### `<SymbolOrAPI>`

**Before (vX)**

```ts
// Example of the old API
import { something } from 'stellar-oracle-sdk'
something({ oldOption: true })
```

**After (vY)**

```ts
// Example of the new API
import { something } from 'stellar-oracle-sdk'
something({ newOption: true })
```

**Why?** Explain the motivation (e.g., security, correctness, performance).

---

## Step-by-step Upgrade Instructions

1. Bump the SDK version in `package.json`:
   ```bash
   npm install stellar-oracle-sdk@Y.0.0
   ```

2. Search for usages of the removed / changed symbol:
   ```bash
   grep -r 'oldSymbol' src/
   ```

3. Apply the replacement shown above.

4. Run your tests:
   ```bash
   npm run test:run
   ```

5. Run the type-checker to catch any remaining issues:
   ```bash
   npm run typecheck
   ```

---

## Removed APIs

| Removed | Replacement | Notes |
|---------|-------------|-------|
| `oldFn()` | `newFn()` | Behaviour unchanged, signature updated |

---

## Deprecated APIs (non-breaking, removed in next major)

| Deprecated | Replacement | Removal version |
|------------|-------------|-----------------|
| `legacyHelper()` | `modernHelper()` | vZ.0.0 |

---

## Need Help?

Open an issue at <https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/issues>
or start a discussion in the repository.
