# Developer Portal SSO (#501)

The frontend implements the client side of an OAuth 2.0 / OIDC Authorization
Code + PKCE flow for GitHub and Google sign-in, gating developer features
(currently: webhook configuration in the notification-channels panel) behind
a verified session. See `src/auth/`.

## Why PKCE, and why no token in the browser

This is a public client (a static SPA) — it cannot hold a client secret. PKCE
(RFC 7636) makes the authorization-code exchange safe without one: the client
generates a random `code_verifier`, sends only its SHA-256 hash
(`code_challenge`) with the authorize request, and later proves it holds the
matching verifier when exchanging the code.

The access/refresh token never reaches the browser. Code exchange and session
issuance happen on the backend, which sets the session as an `httpOnly`,
`Secure`, `SameSite=Lax` cookie. The frontend only ever holds the PKCE
`verifier`/`state` (single-use, non-credential nonces, cleared immediately
after use) in `sessionStorage` — never in `localStorage`, and never the token
itself.

## Flow

1. `useAuth().signIn('github' | 'google')` generates a PKCE verifier/challenge
   and OAuth `state`, stashes them in `sessionStorage`, and redirects to the
   provider's authorize URL.
2. The provider redirects back to `/auth/callback` with `code` and `state`.
3. `AuthCallback` (`src/pages/AuthCallback.tsx`) verifies `state`, then POSTs
   `{ code, codeVerifier, redirectUri }` to `POST /auth/callback/:provider`.
4. The backend exchanges the code with the provider, creates a session, and
   responds with `Set-Cookie` (httpOnly) + `{ user }`.
5. The frontend re-checks `GET /auth/session` on mount and on an interval
   (`config.auth.sessionCheckIntervalMs`, default 5 min) so an expired or
   remotely-revoked session (`POST /auth/signout-all`, "sign out everywhere")
   is reflected without a manual reload.

## Backend contract expected by `src/auth/authApi.ts`

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/auth/session` | — | `200 { user }` or `401` |
| `POST` | `/auth/callback/:provider` | `{ code, codeVerifier, redirectUri }` | `200 { user }`, sets session cookie |
| `POST` | `/auth/signout` | — | `204`, clears session cookie |
| `POST` | `/auth/signout-all` | — | `204`, revokes every session for the user |

## Configuration

| Env var | Purpose |
|---|---|
| `VITE_OAUTH_GITHUB_CLIENT_ID` | Public OAuth client ID for GitHub |
| `VITE_OAUTH_GOOGLE_CLIENT_ID` | Public OAuth client ID for Google |

A provider's sign-in button is disabled (with a tooltip) when its client ID is unset.

## Gating a developer feature

Wrap it in `<DeveloperAuthGate feature="…">`, which renders the SSO buttons
until `useAuth()` reports `status === 'authenticated'`.
