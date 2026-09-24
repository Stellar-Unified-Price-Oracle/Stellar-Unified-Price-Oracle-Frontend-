# Developer Setup Checklist

Use this checklist to verify your VS Code workspace is properly configured.

## Prerequisites

- [ ] VS Code installed (latest version recommended)
- [ ] Node.js and npm installed
- [ ] Project cloned locally
- [ ] Dependencies installed (`npm install`)

## VS Code Setup

- [ ] Opened project folder or workspace file (`stellar-oracle-frontend.code-workspace`)
- [ ] VS Code prompted to install recommended extensions
- [ ] Clicked "Install All" for recommended extensions
- [ ] Waited for extensions to install (1-2 minutes)

## Verification

### Formatter (Prettier)

- [ ] Open `src/main.tsx` or any source file
- [ ] Make code messy: `let x=1;` (add semicolon, remove spaces)
- [ ] Save the file (`Ctrl+S`)
- [ ] Verify code was auto-formatted: `let x = 1` (no semicolon)

**If not working:**
- Check Settings → "formatOnSave" is enabled
- Run Command Palette: `Prettier: Format Document`
- See troubleshooting in `.vscode/SETUP.md`

### Linter (ESLint)

- [ ] Still in `src/main.tsx`
- [ ] Add an unused variable: `const unused = 'test'`
- [ ] Save the file
- [ ] Verify VS Code shows a warning (squiggly line)
- [ ] Hover over it to see "unused variable" error

**If not working:**
- Open Problems panel: `Ctrl+Shift+M`
- Run Command Palette: "ESLint: Show Output"
- See troubleshooting in `.vscode/SETUP.md`

### TypeScript

- [ ] Open `src/hooks/` or any TypeScript file
- [ ] Hover over a variable to see its type
- [ ] Try renaming: Select variable, press `F2`
- [ ] Verify rename works across the file/project

**If not working:**
- Command Palette: "TypeScript: Restart TS Server"
- Check `tsconfig.json` exists at project root

### Extensions Installed

- [ ] Open Extensions panel: `Ctrl+Shift+X`
- [ ] Search for "Prettier" → verify installed (✓)
- [ ] Search for "ESLint" → verify installed (✓)
- [ ] Search for "Tailwind CSS" → verify installed (✓)

### Tasks & Debugging

- [ ] Open Command Palette: `Ctrl+Shift+P`
- [ ] Type "Run Task" and select it
- [ ] Verify you see tasks: "npm: dev", "npm: build", etc.
- [ ] Press `F5` (Debug)
- [ ] Verify you see debug options: Chrome, Firefox

## Common Issues

**"Prettier not running on save"**
- Settings → Search "format on save" → Enable
- Reload: `Ctrl+Shift+P` → "Reload Window"

**"ESLint shows old errors"**
- `Ctrl+Shift+P` → "ESLint: Restart ESLint Server"

**"TypeScript errors not disappearing"**
- `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

**"Extensions didn't install"**
- Install manually:
  - Search extension in marketplace
  - Click Install
  - Or: `code --install-extension extension-id`

## Next Steps

- [ ] Read [`.vscode/SETUP.md`](./SETUP.md) for full guide
- [ ] Run `npm run dev` to start dev server
- [ ] Run tests: `npm test`
- [ ] Build project: `npm run build`
- [ ] Review [CONTRIBUTING.md](../CONTRIBUTING.md) for code style

## Final Check

Run this command to verify all tools work:

```bash
npm run typecheck && npm run lint && npm run build
```

Should complete with no errors. If it does: **Setup complete! ✨**

---

**Setup complete?** Great! Start developing:

```bash
npm run dev
```

App will open at `http://localhost:5173` with:
- ✅ Prettier auto-formatting on save
- ✅ ESLint auto-fixing on save
- ✅ Hot module reloading
- ✅ Full TypeScript support
- ✅ React DevTools integration
