## Summary

- Add actionable SDK diagnostics for API version mismatches, including the server version when available.
- Generate webhook test-payload documentation from its runtime Zod schema. Production alert payload documentation remains dependent on an upstream schema.
- Document safe idempotent retry patterns for SDK mutations.
- Add a loopback-only offline fixture server and smoke test for SDK REST examples.

## Validation

- Focused SDK and webhook schema tests pass (8 tests).
- Offline SDK fixture smoke test passes.
- Full CI is not confirmed: SDK declaration generation fails on the existing TypeScript 6 `baseUrl` deprecation error, and project-wide typecheck reports existing errors.

Closes #799
Closes #800
Closes #801
Closes #802
