# VS Code Workspace Setup

Shared VS Code configuration for the Stellar Unified Price Oracle Frontend project. All developers get consistent formatter, linter, and editor settings automatically.

## Quick Start (2 minutes)

1. **Open the workspace file:**
   ```
   File → Open Workspace from File → stellar-oracle-frontend.code-workspace
   ```

2. **Install extensions:**
   - VS Code will prompt: "Install recommended extensions for this workspace?"
   - Click **Install All**
   - Wait 1-2 minutes for installation

3. **Done!** Start coding with auto-formatting and linting

## What's Configured

| Feature | Tool | Details |
|---------|------|---------|
| **Formatting** | Prettier | No semicolons, single quotes, 120-char lines |
| **Linting** | ESLint | Type safety, import order, React hooks best practices |
| **Type Checking** | TypeScript | Strict mode, full IntelliSense |
| **Debugging** | Built-in | Chrome, Firefox, Playwright support |
| **Extensions** | 17 recommended | Productivity, testing, git, accessibility tools |
| **Tasks** | npm scripts | dev, build, test, lint, format, etc. |

## Included Files

- **`.vscode/settings.json`** — Workspace settings (formatter, linter, editor defaults)
- **`.vscode/extensions.json`** — Recommended VS Code extensions
- **`.vscode/launch.json`** — Debug configurations for Chrome, Firefox, Playwright
- **`.vscode/tasks.json`** — npm tasks (dev, build, test, lint, format)
- **`.vscode/SETUP.md`** — Detailed setup guide with troubleshooting
- **`.vscode/CHECKLIST.md`** — Verification checklist after setup
- **`.vscode/EXTENSIONS.md`** — Description of each recommended extension
- **`stellar-oracle-frontend.code-workspace`** — Workspace file (root)

## Verification

Verify everything is working:

```bash
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run build      # Production build
npm run test:run   # Unit tests
```

Or just save a file — Prettier should auto-format it. ✅

## Usage Tips

| Task | Command |
|------|---------|
| **Format code** | `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (Mac) |
| **Quick fix** | `Ctrl+.` (Windows/Linux) or `Cmd+.` (Mac) |
| **Run task** | `Ctrl+Shift+B` → Select task |
| **Debug** | `F5` → Select debug configuration |
| **Tests** | Click on test file in Test Explorer (sidebar) |
| **Go to definition** | `Ctrl+Click` on a symbol |
| **Rename symbol** | Select symbol, press `F2` |

## Troubleshooting

**Formatter not running on save?**
- Check Settings: Search "formatOnSave" → Enable
- Reload: `Ctrl+Shift+P` → "Developer: Reload Window"

**ESLint showing stale errors?**
- `Ctrl+Shift+P` → "ESLint: Restart ESLint Server"

**TypeScript errors not disappearing?**
- `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

**Extensions didn't install?**
- Install manually from Extensions marketplace
- Or: `code --install-extension extension-id`

## Not Using Workspace File?

If you just opened the folder (instead of using the workspace file), settings still apply from `.vscode/settings.json`. However, the workspace file provides:
- Better naming in tab bar
- Workspace-specific settings isolation
- Better debug/task management

Recommendation: Use the workspace file.

## Team Consistency

These settings ensure the entire team:
- ✅ Formats code identically
- ✅ Uses the same linting rules
- ✅ Gets the same editor experience
- ✅ Follows the same code style

**Do not override these settings.** If you disagree with a rule, open an issue to discuss with the team.

## Next Steps

1. **Read setup guide:** [`.vscode/SETUP.md`](.vscode/SETUP.md)
2. **Verify setup:** [`.vscode/CHECKLIST.md`](.vscode/CHECKLIST.md)
3. **Start dev server:** `npm run dev`
4. **Read contributing guide:** [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

**Questions?** See [`.vscode/SETUP.md`](.vscode/SETUP.md) for detailed guidance and troubleshooting.
