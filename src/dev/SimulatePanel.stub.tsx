/**
 * Production stand-in for `SimulatePanel.tsx` (#475).
 *
 * `vite.config.ts` aliases every import of `./dev/SimulatePanel` to this
 * file for production builds, so the real panel — and everything it pulls
 * in (`dev/wsSimulator.ts`) — is never part of the production module graph
 * at all, regardless of how well a given build's dead-code elimination
 * handles the `import.meta.env.DEV` guard at the call site. This is a
 * belt-and-suspenders guarantee on top of that guard, verified in CI by
 * grepping the built `dist/` output for simulator-specific identifiers.
 */
export function SimulatePanel(): null {
  return null
}
