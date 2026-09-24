# Semantic Versioning & Release Strategy

## Overview

The Stellar Oracle frontend uses **Semantic Versioning** (SemVer) with **Semantic Release** for automated version management and releases. This ensures:

- **Automatic versioning** based on commit messages
- **Reproducible builds** linked to specific versions
- **Automated changelog** generation from commits
- **GitHub releases** with release notes
- **npm package publishing** (if needed)
- **Correlation** between versions and git tags

## How It Works

### 1. Conventional Commits

Every commit must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body

footer
```

**Commit Types (map to version changes):**

| Type | Version | Release Notes | Description |
|------|---------|---------------|-------------|
| `feat` | minor | ✅ Show | New feature |
| `fix` | patch | ✅ Show | Bug fix |
| `perf` | patch | ✅ Show | Performance improvement |
| `refactor` | none | ❌ Hide | Code refactoring |
| `docs` | none | ❌ Hide | Documentation updates |
| `test` | none | ❌ Hide | Test updates |
| `chore` | none | ❌ Hide | Maintenance tasks |
| `ci` | none | ❌ Hide | CI/CD configuration |

**Examples:**

```bash
# Feature (triggers minor version bump)
feat(components): add price alert notifications

# Bug fix (triggers patch version bump)
fix(api): handle network timeout correctly

# Breaking change (triggers major version bump)
feat(api): new authentication system

BREAKING CHANGE: Old auth tokens no longer supported
```

**Scopes (optional):**

- `components` — UI components
- `api` — REST/WebSocket API clients
- `hooks` — React hooks
- `tests` — Test utilities
- `build` — Build configuration
- `deps` — Dependencies
- `docs` — Documentation
- `workers` — Web workers
- `config` — Configuration files
- `context` — React contexts
- `utils` — Utilities
- `types` — TypeScript types
- `pages` — Page components
- `i18n` — Internationalization

### 2. Semantic Release Workflow

```
Push to main
    ↓
GitHub Actions triggers
    ↓
Tests pass
    ↓
Semantic Release analyzes commits
    ↓
Determines version bump (major/minor/patch)
    ↓
Updates package.json version
    ↓
Generates CHANGELOG.md
    ↓
Creates Git tag
    ↓
Publishes to GitHub Releases
    ↓
(Optional) Publishes to npm
    ↓
Deploy to CDN/Vercel
```

### 3. Version Numbers

**Format:** `major.minor.patch[-prerelease]`

- **major** — Breaking changes
- **minor** — New features (backward compatible)
- **patch** — Bug fixes (backward compatible)
- **prerelease** — Alpha, beta, RC versions (for staging/develop branches)

**Examples:**
- `1.0.0` — Initial release
- `1.1.0` — New feature added
- `1.1.1` — Bug fix
- `2.0.0` — Breaking changes
- `2.0.0-rc.1` — Release candidate
- `2.0.0-alpha.1` — Alpha version

## Branch Strategy

### main
- Production releases
- Version: `1.2.3`, `2.0.0`, etc.
- Triggers: GitHub Release, npm publish

### staging
- Pre-release candidates
- Version: `1.2.3-rc.1`, `1.2.3-rc.2`, etc.
- Triggers: GitHub Prerelease

### develop
- Development versions
- Version: `1.2.3-alpha.1`, `1.2.3-alpha.2`, etc.
- Triggers: GitHub Prerelease

## Configuration Files

### .releaserc.json

Defines semantic-release behavior:

```json
{
  "branches": [
    "main",
    { "name": "develop", "prerelease": true },
    { "name": "staging", "prerelease": "rc" }
  ],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github"
  ]
}
```

### .husky/commit-msg

Validates commit messages with commitlint:

```bash
npx --no -- commitlint --edit "$1"
```

### commitlint.config.js

Enforces commit conventions:

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'perf', 'ci']],
    'scope-enum': [1, 'always', ['components', 'api', 'hooks', ...]],
    'subject-case': [2, 'always', 'lower-case'],
  }
}
```

### .github/workflows/release.yml

GitHub Actions workflow for automated releases

## Usage Examples

### Making a Feature Release

```bash
# Create feature branch
git checkout -b feature/new-dashboard

# Make changes
# ...

# Commit with conventional message
git commit -m "feat(components): add new dashboard widget"

# Push and create PR
git push origin feature/new-dashboard

# After PR merge, semantic-release:
# 1. Detects feat commit
# 2. Bumps minor version (1.0.0 → 1.1.0)
# 3. Updates CHANGELOG.md
# 4. Creates git tag v1.1.0
# 5. Publishes GitHub Release
```

### Making a Bug Fix Release

```bash
# Branch from main
git checkout -b fix/price-display
git commit -m "fix(components): correct decimal precision in price display"
git push origin fix/price-display

# After merge, semantic-release:
# 1. Detects fix commit
# 2. Bumps patch version (1.1.0 → 1.1.1)
# 3. Updates CHANGELOG.md
```

### Making a Breaking Change Release

```bash
# Commit with breaking change footer
git commit -m "feat(api): redesign price feed API

BREAKING CHANGE: Old API endpoint /prices has been replaced with /api/v2/prices"

# After merge, semantic-release:
# 1. Detects BREAKING CHANGE
# 2. Bumps major version (1.1.1 → 2.0.0)
# 3. Highlights breaking changes in release notes
```

## Version Reporting

### Get Version in App

```typescript
import { getAppVersion, getVersionInfo, getUserVersionString } from './api/version'

// Get version string
const version = getAppVersion() // "1.2.3"

// Get full version info
const info = getVersionInfo()
console.log(info)
// {
//   version: "1.2.3",
//   commit: "abc1234",
//   buildTime: "2024-01-15T10:30:00Z",
//   environment: "production",
//   branch: "main",
//   prerelease: false,
//   isDev: false,
//   isProd: true
// }

// Get user-friendly version
const userVersion = getUserVersionString() // "1.2.3"

// Log version info
logVersionInfo()
```

### Version API Endpoints

```typescript
import { versionEndpoints } from './api/versionEndpoints'

// GET /api/version
versionEndpoints.getVersion()
// Returns: {
//   success: true,
//   data: {
//     version: "1.2.3",
//     userVersion: "1.2.3",
//     fullInfo: { ... },
//     formatted: "..."
//   }
// }

// GET /health/version
versionEndpoints.getHealthVersion()

// GET /api/version/check?remote=1.2.4
versionEndpoints.checkUpdate('1.2.4')
// Returns: { current: "1.2.3", remote: "1.2.4", needsUpdate: true }
```

## CHANGELOG.md

Generated automatically by semantic-release. Example:

```markdown
# [1.2.0](https://github.com/org/repo/compare/v1.1.0...v1.2.0) (2024-01-15)

## ✨ Features

* **components**: add price alert notifications ([abc1234](https://github.com/org/repo/commit/abc1234))
* **api**: add batch price history endpoint ([def5678](https://github.com/org/repo/commit/def5678))

## 🐛 Bug Fixes

* **api**: handle network timeout correctly ([ghi9012](https://github.com/org/repo/commit/ghi9012))

## ⚡ Performance

* **components**: optimize price list rendering ([jkl3456](https://github.com/org/repo/commit/jkl3456))

### [1.1.0](https://github.com/org/repo/compare/v1.0.0...v1.1.0) (2024-01-10)

...
```

## GitHub Releases

Automatic GitHub Releases are created with:

- **Release title**: Version number (v1.2.0)
- **Release notes**: Generated from commits since last release
- **Pre-release badge**: On develop/staging branches
- **Assets**: Build artifacts

Access at: `https://github.com/org/repo/releases/tag/v1.2.0`

## Best Practices

### ✅ DO

- Write clear, descriptive commit messages
- Use correct type and scope
- Separate concerns (one feature/fix per commit)
- Mention breaking changes in footer
- Reference issues: `Closes #123`
- Use lowercase subject line
- Keep subject under 100 characters

### ❌ DON'T

- Mix features and fixes in one commit
- Use vague commit messages ("fix stuff")
- Skip the scope
- Commit directly to main (use PR workflow)
- Forget to mention breaking changes
- Use imperative mood in subject

### Commit Message Checklist

Before committing, verify:

- [ ] Follows conventional commits format
- [ ] Type is correct (feat, fix, etc.)
- [ ] Scope is relevant and listed
- [ ] Subject is lowercase, imperative, under 100 chars
- [ ] Breaking changes noted in footer
- [ ] References issues if applicable
- [ ] Linter passes (`git cz` for interactive prompts)

## Version Bumping Rules

| Commits | Version Change |
|---------|---|
| Only docs, tests, chore | No release |
| One or more fix | Patch (1.0.0 → 1.0.1) |
| One or more feat | Minor (1.0.0 → 1.1.0) |
| Any BREAKING CHANGE | Major (1.0.0 → 2.0.0) |
| Multiple commits | Highest priority wins |

## Troubleshooting

### Commit message rejected by commitlint

**Error:** `subject-case must be lower-case`

**Fix:** Subject line must be lowercase
```bash
# ❌ Wrong
git commit -m "Fix Prices Widget"

# ✅ Correct
git commit -m "fix(components): fix prices widget"
```

### No release created

**Possible causes:**
- No commits since last release
- All commits are docs/chore (no release triggers)
- Branch not in release branches list

**Solution:**
- Check commit types with `git log`
- Ensure commits are feat/fix/perf type
- Verify branch is main/staging/develop

### Manual version bump needed

**Use this only if semantic-release fails:**

```bash
npm version major   # 1.0.0 → 2.0.0
npm version minor   # 1.0.0 → 1.1.0
npm version patch   # 1.0.0 → 1.0.1

git push origin main --tags
```

## CI/CD Integration

### GitHub Actions Triggers Release

1. Push to main/staging/develop
2. All checks pass
3. Semantic Release runs
4. Updates version in package.json
5. Generates CHANGELOG.md
6. Creates GitHub Release
7. (Optional) Publishes to npm
8. Deploy pipeline triggers

### Version in Deployments

- **Vercel**: Auto-deploys from main
- **CDN**: Check version in browser console
- **Docker**: Include git tag in image tag

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Release Docs](https://semantic-release.gitbook.io/)
- [Commitizen](https://github.com/commitizen/cz-cli) — Interactive commit helper

## Quick Reference

```bash
# Check current version
cat package.json | grep '"version"'

# View commit history with types
git log --oneline --graph

# Create interactive commit (with commitizen)
npm run commit

# View all releases
git tag

# View specific release
git show v1.2.0

# Force version bump (manual only)
npm version patch
git push origin main --tags
```
