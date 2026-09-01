# Recommended VS Code Extensions

This project includes a curated list of VS Code extensions to ensure consistent development experience across the team. When you open the project, VS Code will prompt you to install these extensions.

## Formatters & Linters

**Prettier** (`esbenp.prettier-vscode`)
- Enforces consistent code formatting (no semicolons, single quotes, 120 char line width)
- Configured via `.prettierrc`
- Enables `formatOnSave` for automatic formatting

**ESLint** (`dbaeumer.vscode-eslint`)
- Lints JavaScript/TypeScript for code quality issues
- Configured via `eslint.config.js`
- Runs via `editor.codeActionsOnSave` for automatic fixes

## TypeScript

**TypeScript Nightly** (`ms-vscode.vscode-typescript-next`)
- Latest TypeScript features and performance improvements
- Integrates with project's `tsconfig.json`
- Enables strict type checking in the editor

## React & Web Development

**ES7+ React/Redux/React-Native snippets** (`dsznajder.es7-react-js-snippets`)
- Quick snippets for React components, hooks, and common patterns
- Speeds up development of functional components

**Re-indent** (`tomoki1207.re-indent`)
- Intelligent indentation fixes for structured code

## CSS & Styling

**Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- Autocomplete for Tailwind utility classes
- Hover previews of CSS output
- Tailwind config aware suggestions

## Testing

**Vitest** (`vitest.explorer`)
- Run and debug Vitest tests directly from VS Code
- Test Explorer integration for visual test management

## Git & Version Control

**GitLens** (`eamodio.gitlens`)
- View code authorship inline
- Navigate git history
- Compare branches and commits
- Blame information on hover

**Git History** (`donjayamanne.githistory`)
- Visual git history explorer
- File history and comparisons

## Code Quality

**SonarLint** (`sonarsource.sonarlint-vscode`)
- Real-time code quality analysis
- Security vulnerability detection
- Integration with SonarQube/SonarCloud

## Accessibility

**Web Accessibility Checker** (`deque-systems.web-accessibility-checker`)
- Axe accessibility scanning
- WCAG compliance checking
- Helps ensure inclusive UI

## Documentation

**Markdown Preview GitHub Styling** (`bierner.markdown-preview-github-styles`)
- GitHub-flavored markdown preview
- Better README and ADR document viewing

**YAML** (`redhat.vscode-yaml`)
- YAML syntax highlighting and validation
- Used for configuration files

## Debugging

**Firefox Debugger** (`firefox-devtools.vscode-firefox-debug`)
- Debug React app in Firefox directly from VS Code
- Source map support

**Edge DevTools** (`ms-edgedevtools.vscode-edge-devtools`)
- Debug React app in Edge Chromium directly from VS Code

## Productivity

**Code Runner** (`formulahendry.code-runner`)
- Run code snippets or entire files
- Useful for quick testing of utilities

## Installation

All recommended extensions are listed in `.vscode/extensions.json`. VS Code will prompt you to install them when you open the project. You can also install them manually:

```bash
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
# ... etc
```

Or open VS Code extensions panel and search for each extension ID.

## Optional Extensions

Feel free to add your own preferred extensions (theme, terminal, productivity tools, etc.). Workspace settings take precedence and will ensure consistent formatting and linting across the team.
