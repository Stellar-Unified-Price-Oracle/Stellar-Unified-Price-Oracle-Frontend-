# Contributing to Stellar Unified Price Oracle — Frontend

Thank you for your interest in contributing. This guide covers everything you need to get the project running locally and submit a pull request.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22 or higher |
| npm | 10 or higher (bundled with Node 22) |
| Git | Any recent version |

Verify your setup:

```sh
node --version   # should print v22.x.x or higher
npm --version    # should print 10.x.x or higher
```

## Clone and Install

```sh
git clone https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-.git
cd Stellar-Unified-Price-Oracle-Frontend-
npm install
```

## Environment Configuration

Copy the example file and fill in values as needed:

```sh
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Aggregator API base URL |
| `VITE_WS_URL` | `ws://localhost:3000` | WebSocket endpoint |
| `VITE_OPENAPI_SPEC_URL` | _(empty)_ | Optional URL to an OpenAPI spec (shown as a link on `/api-docs`) |

## Running the Dev Server

```sh
npm run dev
```

The app is available at `http://localhost:5173`. Vite proxies `/api` and `/ws` to the backend specified in your `.env`, so no manual CORS configuration is required during development.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production (outputs to `dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format source files with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run test` | Run tests in watch mode (Vitest) |
| `npm run test:run` | Run tests once and exit |
| `npm run build:analyze` | Build and open an interactive bundle treemap |
| `npm run size-limit` | Check bundle sizes against CI budgets |

## Running Tests, Lint, and Typecheck

Before pushing, run the full verification suite:

```sh
npm run typecheck   # zero TypeScript errors
npm run lint        # zero lint errors
npm run build       # production build succeeds
npm run test:run    # all unit tests pass
```

The pre-push git hook (`husky/pre-push`) runs `npm run build` and `npm run test:run` automatically. A push that fails either step is aborted.

## Code Style

- **No semicolons** at the end of statements
- **Single quotes** for strings
- **2-space indentation**
- Tailwind utility classes for all styling — no CSS modules or inline styles
- Named exports for all components and hooks
- Run `npm run format` before committing to apply Prettier automatically

ESLint and Prettier are enforced in CI. The `lint-staged` configuration applies them automatically to staged files during commits.

## Commit Conventions

Use a short, imperative commit message describing what changed and why:

```
feat: add price history chart for asset pair detail page
fix: prevent duplicate WebSocket reconnect timers
docs: clarify CORS requirements for backend deployments
```

Common prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

Keep each commit focused on a single logical change. If a PR addresses multiple issues, give each issue its own commit.

## Pull Request Process

1. **Branch from `main`** — use a descriptive branch name, e.g. `feat/price-export-json`.
2. **One concern per PR** — keep scope small and reviewable.
3. **Address the acceptance criteria** listed in the linked issue before requesting review.
4. **Pass CI** — the pipeline runs typecheck, lint, build, and unit tests on every PR.
5. **Include `Closes #<issue>` tags** in the PR description for every issue the PR resolves.
6. **Request a review** from a maintainer. At least one approval is required to merge.

PRs that skip verification steps, bundle unrelated changes, or miss the acceptance criteria will be asked to revise before merging.

## Project Structure

```
src/
├── api/          # REST + WebSocket clients and validation
├── components/   # Reusable UI components
├── config/       # Environment configuration
├── context/      # React context providers
├── hooks/        # Custom hooks
├── pages/        # Route-level page components
├── test/         # Test helpers and setup
├── types/        # TypeScript type definitions
└── utils/        # Formatting, export, and sanitization helpers
docs/
├── adr/          # Architecture Decision Records
└── CORS.md       # Backend CORS configuration guide
```

## Getting Help

Open an issue or start a discussion on GitHub. Please search existing issues before filing a new one.
