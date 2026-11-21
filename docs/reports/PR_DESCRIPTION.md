## Summary

- Document the backend contracts needed for feed-schema compatibility, read-only request replay, API-key usage breakdown, and quota forecasting.
- Link the dependency notes from the API documentation.
- No UI or runtime feature is implemented; each depends on backend capabilities not present in the current API.

## Validation

- Documentation formatting hook passed.
- `git diff --check` passed.
- Recent GitHub Actions runs failed at `npm ci` because package entries are missing from the lockfile. This branch has not yet had a CI run.

Closes #806
Closes #805
Closes #804
Closes #803
