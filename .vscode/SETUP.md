# VS Code Workspace Setup Guide

This guide explains the VS Code configuration for the Stellar Unified Price Oracle Frontend project.

## Quick Start

### Option 1: Use the Workspace File (Recommended)

1. Open the root directory in VS Code
2. File → Open Workspace from File → Select `stellar-oracle-frontend.code-workspace`
3. VS Code will prompt to install recommended extensions — click "Install All"

### Option 2: Use Folder Settings

1. Open the root directory in VS Code
2. Settings are automatically applied from `.vscode/settings.json`
3. Extensions panel → Click "Install All" on the extensions recommendation

## What's Configured

### Editor Settings

- **Tab size**: 2 spaces
- **Line width**: 120 characters (with ruler guide)
- **Trailing whitespace**: Auto-removed on save
- **Final newline**: Auto-added on save
- **Word wrap**: Enabled at 120 characters

### Code Formatting

- **Formatter**: Prettier (auto-runs on save)
- **No semicolons**: JavaScript/TypeScript style
- **Single quotes**: For consistency
- **Trailing commas**: Always include

Example: When you save a file, Prettier automatically reformats it.

```tsx
// Before save (typed by you)
function Component(){return <div>content</div>}

// After save (auto-formatted)
function Component() {
  return <div>content</div>
}
```

### Linting

- **Linter**: ESLint (config in `eslint.config.js`)
- **Auto-fix**: Runs on save via `codeActionsOnSave`
- **Rules enforced**:
  - No unused variables (unless prefixed with `_`)
  - Proper import ordering
  - React hooks best practices

Example: Unused imports are auto-fixed on save.

### TypeScript

- **TypeScript SDK**: Uses project version (`node_modules/typescript`)
- **Strict mode**: Full type checking enabled
- **Quote preference**: Single quotes
- **Import style**: Shortest path resolution

### File Exclusions

Hidden from search and file explorer:

- `node_modules/` (dependencies)
- `dist/` (build output)
- `.cache/` (temporary files)
- `reports/` (bundle analysis)

These can still be opened manually; they're just hidden to reduce clutter.

## Recommended Extensions

**Core Productivity** (Must-have):
- `esbenp.prettier-vscode` — Code formatter
- `dbaeumer.vscode-eslint` — Code linter
- `bradlc.vscode-tailwindcss` — Tailwind CSS helper

**Development** (Highly recommended):
- `vitest.explorer` — Test runner in VS Code
- `eamodio.gitlens` — Git history and blame
- `dsznajder.es7-react-js-snippets` — React snippets

**Optional** (Personal preference):
- Theme (e.g., One Dark Pro)
- Terminal theme
- Icon pack

See [`.vscode/EXTENSIONS.md`](./EXTENSIONS.md) for detailed descriptions.

## Tasks & Commands

VS Code tasks are configured in `.vscode/tasks.json`. Run them via:

1. **Terminal** → **Run Task** or press `Ctrl+Shift+B`
2. Common tasks:
   - **npm: dev** — Start dev server (auto-runs on reload)
   - **npm: build** — Production build
   - **npm: typecheck** — Type checking
   - **npm: lint** — Linting
   - **npm: test** — Unit tests (watch mode)
   - **npm: test:e2e** — End-to-end tests
   - **npm: format** — Auto-format code

## Debug Configurations

Launch configurations are in `.vscode/launch.json`. Press `F5` to debug:

1. **Chrome** — Debug in Chrome browser
2. **Firefox** — Debug in Firefox browser
3. **Playwright Test** — Debug end-to-end tests

Example: Press F5, select "Chrome", then navigate to `http://localhost:5173` to debug your React app.

## Tips & Tricks

### Format on Demand

- **Format file**: `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (Mac)
- **Format selection**: Highlight code, then use above shortcut

### Quick Lint Fixes

- **Quick fix**: `Ctrl+.` (Windows/Linux) or `Cmd+.` (Mac)
- Shows available auto-fixes for the current line

### Run Tests

- **Test Explorer** sidebar shows all tests
- Click to run individual tests or test files
- Tests run in watch mode by default

### TypeScript Features

- **Hover**: Hover over variables to see types
- **Go to Definition**: `Ctrl+Click` or `Ctrl+G`
- **Rename**: `F2` to rename symbols across the project

### Debug React Components

1. Open DevTools (`F12` or `Ctrl+Shift+I`)
2. Components tab shows React component tree
3. Click component to jump to source

## Troubleshooting

### Formatter not running on save

1. Check: Settings → Search "formatOnSave" → Verify it's enabled
2. Check: Editor → Default Formatter → Should be "Prettier - Code formatter"
3. Restart VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

### ESLint showing stale errors

1. Open Command Palette: `Ctrl+Shift+P`
2. Search "ESLint: Restart ESLint Server"
3. Reload window if needed

### TypeScript errors not disappearing

1. `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
2. Check `tsconfig.json` is not corrupted (use `npm run typecheck`)

### Extensions not installing

1. Install extension manually:
   - Search extension ID in Extensions marketplace
   - Click Install
2. Or command line: `code --install-extension extension-id`

### .vscode/ settings not applying

1. Verify you opened the folder (not a file)
2. Check `.vscode/settings.json` is not corrupted (valid JSON)
3. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"

## Team Consistency

These settings ensure all developers on the team:

- ✅ Format code identically (Prettier)
- ✅ Use the same linting rules (ESLint)
- ✅ Get the same IntelliSense behavior (TypeScript)
- ✅ Have the same debugging tools available
- ✅ Follow the same code style conventions

**Do not override these settings.** If you disagree with a rule:

1. Open an issue or discuss in code review
2. Propose a change to the team
3. Update all config files together (eslint.config.js, .prettierrc, etc.)

This keeps the codebase consistent and makes it easier for developers to switch between machines or projects.

## Additional Resources

- [VS Code Settings](https://code.visualstudio.com/docs/getstarted/settings)
- [ESLint Configuration](../../../eslint.config.js)
- [Prettier Configuration](../../../.prettierrc)
- [TypeScript Configuration](../../../tsconfig.json)
- [Project README](../../../README.md)
- [Contributing Guide](../../../CONTRIBUTING.md)
