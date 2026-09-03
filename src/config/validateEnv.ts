import { z } from 'zod'

/**
 * Zod schema for all Vite environment variables consumed by the app.
 *
 * VITE_API_URL and VITE_WS_URL are required; all others are optional.
 * Unknown keys are stripped so extra variables do not cause validation errors.
 */
const envSchema = z.object({
  // ── API ────────────────────────────────────────────────────────────────────
  VITE_API_URL: z.string().min(1, 'VITE_API_URL must not be empty').default('/api'),

  VITE_WS_URL: z.string().min(1, 'VITE_WS_URL must not be empty').default('ws://localhost:3000'),

  VITE_OPENAPI_SPEC_URL: z.string().default(''),

  // ── On-chain ───────────────────────────────────────────────────────────────
  // Soroban network the on-chain comparison panel reads from by default.
  VITE_ORACLE_NETWORK: z
    .enum(['mainnet', 'testnet', 'futurenet'])
    .default('testnet'),

  // ── Analytics ──────────────────────────────────────────────────────────────
  VITE_ANALYTICS_URL: z.string().default(''),

  // ── Features ───────────────────────────────────────────────────────────────
  VITE_USE_MOCK: z.enum(['true', 'false']).default('false'),

  // ── Debug ──────────────────────────────────────────────────────────────────
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),

  // ── Stellar network ────────────────────────────────────────────────────────
  // Which Stellar network the on-chain oracle contract (and explorer links for
  // the price Proof tab) resolve against. See docs/adr/0001-onchain-soroban-price-oracle.md.
  VITE_STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),

  // ── Developer portal SSO (#501) ────────────────────────────────────────────
  // OAuth2/OIDC client IDs for the dev-portal sign-in. Public client IDs only —
  // no client secret ever belongs in frontend code. Token exchange and session
  // cookies are handled by the backend `/auth/*` endpoints. See src/auth/.
  VITE_OAUTH_GITHUB_CLIENT_ID: z.string().default(''),
  VITE_OAUTH_GOOGLE_CLIENT_ID: z.string().default(''),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate the Vite import.meta.env object at runtime and return a typed,
 * fully-defaulted environment object.
 *
 * Throws a descriptive error in development when required variables are
 * missing or malformed.  In production the error is logged to the console
 * so the app can still start with defaults rather than crashing.
 */
export function validateEnv(env: Record<string, string | boolean | undefined> = {}): Env {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    const message = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')

    const full = `Environment validation failed:\n${message}`

    if (import.meta.env.MODE !== 'production') {
      throw new Error(full)
    }

    // In production: warn and fall back to defaults so the app can attempt
    // to start even with a misconfigured deployment.
    console.error(full)
    // Return defaults by parsing an empty object — every field has a default.
    return envSchema.parse({})
  }

  return result.data
}

/**
 * Legacy helper kept for backwards-compatibility with existing callers that
 * only check which required vars are missing.
 *
 * Prefer `validateEnv()` for new code.
 *
 * @deprecated Use validateEnv() instead.
 */
export const REQUIRED_ENV_VARS = ['VITE_API_URL', 'VITE_WS_URL'] as const

/**
 * @deprecated Use validateEnv() instead.
 */
export function getMissingRequiredEnvVars(env: Record<string, string | boolean | undefined>): string[] {
  return REQUIRED_ENV_VARS.filter((name) => {
    const value = env[name]
    return typeof value !== 'string' || value.trim() === ''
  })
}
