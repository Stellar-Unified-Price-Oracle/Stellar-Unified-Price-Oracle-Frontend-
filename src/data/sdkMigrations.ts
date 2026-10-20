/**
 * Migration examples for each supported SDK major version (#809).
 *
 * Each entry shows how to move an integration onto that major from the shape
 * it replaces. The repo has shipped only major 1 so far, so v1 documents the
 * move from hand-written REST calls. When a new major ships, add its entry
 * here and list it in {@link SUPPORTED_SDK_MAJORS}; the tests fail until it is
 * documented.
 */

/** Majors the SDK currently supports. Keep in step with the published `sdk-vX.Y.Z` tags. */
export const SUPPORTED_SDK_MAJORS: readonly number[] = [1]

export interface MigrationExample {
  label: string
  before: string
  after: string
}

export interface SdkMajorMigration {
  major: number
  title: string
  summary: string
  /** Behaviour changes a developer must account for when they move to this major. */
  breakingChanges: readonly string[]
  examples: readonly MigrationExample[]
}

export const SDK_MIGRATIONS: readonly SdkMajorMigration[] = [
  {
    major: 1,
    title: 'Migrating to SDK v1',
    summary:
      'v1 replaces hand-written fetch calls with a typed client. Requests keep the same REST paths, so the change is in how responses and failures are handled.',
    breakingChanges: [
      'Non-2xx responses throw a typed OracleError subclass, such as OracleNotFoundError, instead of resolving with an error body.',
      'Network failures throw OracleNetworkError after the client has retried retryable errors up to maxRetries (default 3).',
      'Every request sends an Accept header that names the API version, so check the server version before pinning a client.',
    ],
    examples: [
      {
        label: 'Fetch one pair',
        before: `const res = await fetch('https://api.example.com/api/prices/XLM-USD')
if (!res.ok) throw new Error(\`Request failed: \${res.status}\`)
const price = await res.json()`,
        after: `import { OracleClient, OracleNotFoundError } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: 'https://api.example.com' })
try {
  const price = await client.getPrice('XLM-USD')
} catch (error) {
  if (error instanceof OracleNotFoundError) console.warn('XLM-USD is not tracked')
  else throw error
}`,
      },
      {
        label: 'Fetch paginated history',
        before: `const res = await fetch('https://api.example.com/api/prices/XLM-USD/history?limit=50&offset=0')
const history = await res.json()`,
        after: `import { OracleClient } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: 'https://api.example.com' })
const history = await client.getHistory('XLM-USD', 50, 0)`,
      },
    ],
  },
]
