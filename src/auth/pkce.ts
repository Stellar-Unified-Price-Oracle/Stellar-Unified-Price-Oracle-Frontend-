/**
 * OAuth 2.0 PKCE (RFC 7636) helpers for the dev-portal SSO flow (#501).
 *
 * All of this runs in the browser with the public Web Crypto API — there is
 * no client secret anywhere in this module, which is what makes the
 * "authorization code + PKCE" flow safe for a single-page app.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A cryptographically random, URL-safe string used as the PKCE `code_verifier` and OAuth `state`. */
export function randomUrlSafeString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

/** Derives the PKCE `code_challenge` (S256) from a `code_verifier`. */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

export interface PkceParams {
  verifier: string
  challenge: string
  state: string
}

/** Generates a fresh verifier/challenge/state triple for one sign-in attempt. */
export async function createPkceParams(): Promise<PkceParams> {
  const verifier = randomUrlSafeString()
  const [challenge, state] = await Promise.all([deriveCodeChallenge(verifier), Promise.resolve(randomUrlSafeString(16))])
  return { verifier, challenge, state }
}
