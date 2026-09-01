# VS Code Workspace Configuration

This directory contains shared VS Code configuration for the Stellar Unified Price Oracle Frontend project. All developers on the team will have consistent formatter, linter, and editor settings.

## Files in this Directory

### Core Configuration

**`settings.json`** — Workspace settings
- Editor defaults (tab size, line width, auto-format)
- Formatter configuration (Prettier)
- Linter configuration (ESLint)
- TypeScript preferences
- File exclusions and search filters

**`extensions.json`** — Recommended extensions
- Prettier, ESLint, TypeScript
- React snippets, Tailwind CSS
- Debugging tools (Chrome, Firefox, Playwright)
- Git helpers (GitLens, history)
- Code quality (SonarLint, accessibility checker)

**`launch.json`** — Debug configurations
- Chrome debugging at `http://localhost:5173`
- Firefox debugging
- Playwright E2E test debugging

**`tasks.json`** — VS Code tasks
- `npm: dev` — Start dev server
- `npm: build` — Production build
- `npm: typecheck` — Type checking
- `npm: lint` — Linting
- `npm: test` — Unit tests (watch)
- `npm: format` — Code formatting

### Documentation

**`SETUP.md`** — Developer setup guide
- Quick start instructions
- Configuration details explained
- Tips & tricks
- Troubleshooting

**`EXTENSIONS.md`** — Extension descriptions
- What each extension does
- Why it's recommended
- Installation instructions

## Root Workspace File

**`../stellar-oracle-frontend.code-workspace`** — Workspace file
- Duplicate of settings from this directory
- Can be opened directly: File → Open Workspace from File
- Provides better experience than folder settings

## Getting Started

1. **Open the workspace:**
   - File → Open Workspace from File → Select `stellar-oracle-frontend.code-workspace`
   - Or open the folder and VS Code will use `.vscode/settings.json`

2. **Install extensions:**
   - VS Code will prompt to install recommended extensions
   - Or Extensions → Search "Recommended" → Install All

3. **Verify setup:**
   - Check that Prettier is formatting on save (try saving a file)
   - Check that ESLint shows errors/warnings (look at Problems panel)
   - Open `.vscode/SETUP.md` for more guidance

## What Gets Standardized

✅ **Code Formatting** — Prettier (no semicolons, single quotes, 120 char lines)
✅ **Code Quality** — ESLint (unused variables, import order, React hooks)
✅ **Type Checking** — TypeScript (strict mode, single quotes)
✅ **Debug Experience** — Chrome, Firefox, Playwright debugging
✅ **Development Tools** — 17 recommended extensions
✅ **Editor Behavior** — Auto-save, trim whitespace, final newlines

## Important Notes

- **Do not modify settings.json** — These are team standards. Propose changes in code review.
- **Extensions are recommendations** — Install them but also add personal preferences (theme, terminal, etc.)
- **Workspace file is optional** — You can use folder settings instead, but the workspace file provides a better experience.

## Questions?

Refer to:
- [`.vscode/SETUP.md`](./SETUP.md) — Setup and troubleshooting
- [`.vscode/EXTENSIONS.md`](./EXTENSIONS.md) — Extension details
- [Project README](../README.md) — Project overview
- [Contributing Guide](../CONTRIBUTING.md) — Development guidelines
