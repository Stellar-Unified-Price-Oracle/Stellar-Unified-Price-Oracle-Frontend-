import { describe, expect, it, vi } from 'vitest'
import { SDK_CHECKLIST_STEPS, runChecklistStep, type ChecklistContext } from './sdkChecklist'

const BASE_URL = 'https://api.example.test'

function step(id: string) {
  const found = SDK_CHECKLIST_STEPS.find((s) => s.id === id)
  if (!found) throw new Error(`missing step ${id}`)
  return found
}

/** Routes each request path to a canned JSON response (or a bare status). */
function routeFetch(routes: Record<string, { status: number; body?: unknown }>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    const route = routes[path] ?? { status: 404 }
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
      status: route.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

function ctxWith(fetchImpl: typeof fetch, baseUrl = BASE_URL): ChecklistContext {
  return { baseUrl, fetchImpl }
}

const VALID_PRICE = { assetPair: 'XLM-USD', price: 0.12, timestamp: 1_700_000_000_000 }

describe('SDK integration checklist steps', () => {
  it('accepts an absolute http(s) base URL and rejects anything else', async () => {
    const verify = step('base-url').verify
    expect((await verify(ctxWith(fetch, 'https://api.example.test'))).ok).toBe(true)
    expect((await verify(ctxWith(fetch, 'http://localhost:3000'))).ok).toBe(true)
    expect((await verify(ctxWith(fetch, 'ftp://files.example.test'))).ok).toBe(false)
    expect((await verify(ctxWith(fetch, ''))).detail).toMatch(/not an absolute URL/)
  })

  it('passes the health check only on a 200 response', async () => {
    const verify = step('health').verify
    const ok = await verify(ctxWith(routeFetch({ '/health': { status: 200, body: { status: 'ok' } } })))
    const down = await verify(ctxWith(routeFetch({ '/health': { status: 503 } })))

    expect(ok).toEqual({ ok: true, detail: 'GET /health returned 200' })
    expect(down).toEqual({ ok: false, detail: 'GET /health returned 503' })
  })

  it('verifies the price list is a non-empty array of well-formed entries', async () => {
    const verify = step('prices-shape').verify

    const valid = routeFetch({ '/api/prices': { status: 200, body: [VALID_PRICE] } })
    expect(await verify(ctxWith(valid))).toEqual({ ok: true, detail: 'Parsed 1 price entries' })
    expect(valid).toHaveBeenCalledWith(
      `${BASE_URL}/api/prices`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )

    const empty = await verify(ctxWith(routeFetch({ '/api/prices': { status: 200, body: [] } })))
    expect(empty.ok).toBe(false)
    expect(empty.detail).toMatch(/empty/)

    const notArray = await verify(ctxWith(routeFetch({ '/api/prices': { status: 200, body: { prices: [] } } })))
    expect(notArray.detail).toMatch(/did not return a JSON array/)

    const malformed = await verify(
      ctxWith(routeFetch({ '/api/prices': { status: 200, body: [{ assetPair: 'XLM-USD', price: '0.12' }] } })),
    )
    expect(malformed.detail).toMatch(/missing assetPair, price or timestamp/)
  })

  it('checks that a single pair lookup returns the requested pair', async () => {
    const verify = step('pair-lookup').verify

    const match = await verify(ctxWith(routeFetch({ '/api/prices/XLM-USD': { status: 200, body: VALID_PRICE } })))
    expect(match.ok).toBe(true)

    const untracked = await verify(ctxWith(routeFetch({ '/api/prices/XLM-USD': { status: 404 } })))
    expect(untracked.detail).toMatch(/not tracked/)

    const wrongPair = await verify(
      ctxWith(routeFetch({ '/api/prices/XLM-USD': { status: 200, body: { ...VALID_PRICE, assetPair: 'BTC-USD' } } })),
    )
    expect(wrongPair.ok).toBe(false)
  })
})

describe('runChecklistStep', () => {
  it('reports a network failure as a failed step instead of throwing', async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await runChecklistStep(step('health'), ctxWith(failing as unknown as typeof fetch))

    expect(result).toEqual({ ok: false, detail: 'Request failed: Failed to fetch' })
  })

  it('reports a cancelled run as cancelled when the signal was aborted', async () => {
    const controller = new AbortController()
    const aborting = vi.fn(async () => {
      controller.abort()
      throw new DOMException('Aborted', 'AbortError')
    })
    const result = await runChecklistStep(step('health'), {
      baseUrl: BASE_URL,
      fetchImpl: aborting as unknown as typeof fetch,
      signal: controller.signal,
    })

    expect(result).toEqual({ ok: false, detail: 'Check cancelled' })
  })
})
