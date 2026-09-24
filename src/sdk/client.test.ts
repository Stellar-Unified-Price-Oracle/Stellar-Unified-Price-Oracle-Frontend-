import { describe, expect, it, vi } from 'vitest'
import { OracleClient } from './client'
const response = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
describe('OracleClient rate-limit awareness', () => {
  it('exposes rate-limit headers', async () => { const client = new OracleClient({ fetch: vi.fn().mockResolvedValue(response(200, { price: 1 }, { 'X-RateLimit-Limit': '10', 'X-RateLimit-Remaining': '9', 'X-RateLimit-Reset': '123' })) }); await client.getPrice('XLM-USD'); expect(client.rateLimitState).toMatchObject({ limit: 10, remaining: 9, reset: 123 }) })
  it('honours Retry-After before retrying 429', async () => { const fetcher = vi.fn().mockResolvedValueOnce(response(429, {}, { 'Retry-After': '2' })).mockResolvedValueOnce(response(200, { price: 1 })); const sleep = vi.fn().mockResolvedValue(undefined); const client = new OracleClient({ fetch: fetcher, sleep, random: () => 0 }); await client.getPrice('XLM-USD'); expect(sleep).toHaveBeenCalledWith(2000); expect(fetcher).toHaveBeenCalledTimes(2) })
})
