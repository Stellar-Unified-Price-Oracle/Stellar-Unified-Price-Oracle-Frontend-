/**
 * SDK integration checklist (#808).
 *
 * Each step is an executable check against the configured API rather than a
 * static tick-box: it issues the same requests the SDK examples make and
 * reports whether the response has the shape the integration relies on.
 * `fetchImpl` is injectable so the checks run unchanged in tests.
 */

export interface ChecklistStepResult {
  ok: boolean
  /** Short, user-facing explanation of what was observed. */
  detail: string
}

export interface ChecklistContext {
  /** Origin of the API, without a trailing `/api` (e.g. `https://api.example.com`). */
  baseUrl: string
  fetchImpl: typeof fetch
  signal?: AbortSignal
}

export interface ChecklistStep {
  id: string
  title: string
  /** What the developer should confirm; shown under the title. */
  instructions: string
  verify: (ctx: ChecklistContext) => Promise<ChecklistStepResult>
}

const JSON_HEADERS = { Accept: 'application/json' }

async function getJson(ctx: ChecklistContext, path: string): Promise<{ status: number; body: unknown }> {
  const response = await ctx.fetchImpl(`${ctx.baseUrl}${path}`, { headers: JSON_HEADERS, signal: ctx.signal })
  const body = response.ok ? await response.json().catch(() => null) : null
  return { status: response.status, body }
}

function isPriceEntry(value: unknown): value is { assetPair: string; price: number; timestamp: number } {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry.assetPair === 'string' && typeof entry.price === 'number' && typeof entry.timestamp === 'number'
}

export const SDK_CHECKLIST_STEPS: readonly ChecklistStep[] = [
  {
    id: 'base-url',
    title: 'Configure an absolute API base URL',
    instructions: 'Pass baseUrl to new OracleClient(). It must be an http or https origin.',
    verify: async ({ baseUrl }) => {
      try {
        const url = new URL(baseUrl)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { ok: false, detail: `Unsupported protocol ${url.protocol}` }
        }
        return { ok: true, detail: `Base URL is ${url.origin}` }
      } catch {
        return { ok: false, detail: 'The base URL is empty or not an absolute URL' }
      }
    },
  },
  {
    id: 'health',
    title: 'Confirm the API health endpoint responds',
    instructions: 'Call GET /health before relying on prices. A non-200 response means the API is not ready.',
    verify: async (ctx) => {
      const { status } = await getJson(ctx, '/health')
      return status === 200
        ? { ok: true, detail: 'GET /health returned 200' }
        : { ok: false, detail: `GET /health returned ${status}` }
    },
  },
  {
    id: 'prices-shape',
    title: 'Parse the aggregated price list',
    instructions: 'client.getPrices() should return entries with assetPair, price and timestamp.',
    verify: async (ctx) => {
      const { status, body } = await getJson(ctx, '/api/prices')
      if (status !== 200) return { ok: false, detail: `GET /api/prices returned ${status}` }
      if (!Array.isArray(body)) return { ok: false, detail: 'GET /api/prices did not return a JSON array' }
      if (body.length === 0) return { ok: false, detail: 'The price list is empty, so there is nothing to parse yet' }
      if (!body.every(isPriceEntry)) {
        return { ok: false, detail: 'At least one entry is missing assetPair, price or timestamp' }
      }
      return { ok: true, detail: `Parsed ${body.length} price entries` }
    },
  },
  {
    id: 'pair-lookup',
    title: 'Look up a single pair',
    instructions: 'client.getPrice("XLM-USD") should return the requested pair.',
    verify: async (ctx) => {
      const { status, body } = await getJson(ctx, '/api/prices/XLM-USD')
      if (status === 404) return { ok: false, detail: 'XLM-USD is not tracked by this API' }
      if (status !== 200) return { ok: false, detail: `GET /api/prices/XLM-USD returned ${status}` }
      if (!isPriceEntry(body) || body.assetPair !== 'XLM-USD') {
        return { ok: false, detail: 'The response did not describe XLM-USD' }
      }
      return { ok: true, detail: 'XLM-USD resolved to a price' }
    },
  },
]

/**
 * Runs one check. Network failures and aborts are reported as a failed step
 * instead of throwing, so one unreachable endpoint never stops the others.
 */
export async function runChecklistStep(step: ChecklistStep, ctx: ChecklistContext): Promise<ChecklistStepResult> {
  try {
    return await step.verify(ctx)
  } catch (error) {
    if (ctx.signal?.aborted) return { ok: false, detail: 'Check cancelled' }
    const message = error instanceof Error ? error.message : 'Request failed'
    return { ok: false, detail: `Request failed: ${message}` }
  }
}
