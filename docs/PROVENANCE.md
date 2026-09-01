# Release provenance & signed commits

## Build provenance

Every push to `main` that produces a release (`.github/workflows/release.yml`) packages
the `dist/` build as `dist.tar.gz` and generates a signed [SLSA](https://slsa.dev/)-style
build provenance attestation using GitHub's
[`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance).

- Signing uses the workflow run's short-lived **OIDC identity** (Sigstore/Fulcio) — no
  long-lived signing keys are stored in the repo or CI secrets.
- The attestation binds the artifact's SHA-256 digest to the exact commit, workflow
  file, and runner that produced it.
- The step runs with `if: success()` immediately before the deploy step, and the job
  has no `continue-on-error`, so **a signing failure stops the release** — an
  unattested build is never shipped from this workflow.

### Verifying an artifact as a consumer

```bash
# 1. Download the release artifact (dist.tar.gz) for the commit/tag you care about.

# 2. Verify it was built by this repo's release workflow, using the GitHub CLI:
gh attestation verify dist.tar.gz --repo Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-

# 3. Inspect the full attestation (predicate, builder id, source commit):
gh attestation verify dist.tar.gz \
  --repo Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend- \
  --format json | jq '.[0].verificationResult.statement.predicate'
```

A successful `verify` confirms the artifact's digest matches an attestation signed by
this repository's `release.yml` workflow — i.e. it was not modified after the build and
did not come from a fork or an unrelated pipeline.

## Signed commits (maintainers)

This repo does not (yet) enforce signed commits at the branch-protection level, but
maintainers are asked to sign their commits so history is independently verifiable:

1. Generate a signing key (GPG or, simpler, an SSH key you already have) and add it to
   your GitHub account under **Settings → SSH and GPG keys**.
2. Configure git to sign by default:
   ```bash
   # SSH signing (recommended — reuses your existing SSH key)
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub
   git config --global commit.gpgsign true

   # or GPG signing
   git config --global user.signingkey <YOUR_GPG_KEY_ID>
   git config --global commit.gpgsign true
   ```
3. Enable **"Vigilant mode"** under GitHub Settings → SSH and GPG keys, so unsigned
   commits pushed under your account are flagged.

Repo admins: to make this enforced rather than advisory, enable **"Require signed
commits"** on the `main` branch protection rule under Settings → Branches. This is a
GitHub repository setting, not something CI can turn on from within the workflow.
