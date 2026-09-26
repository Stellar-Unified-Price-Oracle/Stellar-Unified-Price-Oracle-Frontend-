import { describe, expect, it, vi } from 'vitest'
import { OracleClient } from './client'
import { OracleNotFoundError, OracleRateLimitError, OracleValidationError } from './errors'
import { computeDelay, DEFAULT_RETRY_POLICY } from './retry'
const res = (s: number, b: unknown = {}, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status: s, headers: h })
describe('error taxonomy and retry', () => {
  it('maps status to typed terminal errors without retry', async () => {
    const f = vi.fn().mockResolvedValue(res(404))
    await expect(new OracleClient({ fetch: f }).getPrice('X')).rejects.toBeInstanceOf(OracleNotFoundError)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('maps server code in body', async () => {
    const f = vi.fn().mockResolvedValue(res(400, { code: 'validation_failed' }))
    await expect(new OracleClient({ fetch: f }).getPrices()).rejects.toBeInstanceOf(OracleValidationError)
  })
  it('retries 429 honoring Retry-After then throws typed error', async () => {
    const f = vi.fn().mockResolvedValue(res(429, {}, { 'Retry-After': '1' }))
    const sleep = vi.fn().mockResolvedValue(undefined)
    await expect(new OracleClient({ fetch: f, sleep, maxRetries: 1, random: () => 0 }).getPrices()).rejects.toBeInstanceOf(OracleRateLimitError)
    expect(sleep).toHaveBeenCalledWith(1000)
  })
  it('reuses idempotency key across retries', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200, {}))
    await new OracleClient({ fetch: f, sleep: async () => {} }).createAlert({ assetPair: 'X' })
    const keys = f.mock.calls.map((c) => c[1].headers['Idempotency-Key'])
    expect(keys[0]).toBeTruthy()
    expect(keys[0]).toBe(keys[1])
  })
  it('caps delay', () => expect(computeDelay(DEFAULT_RETRY_POLICY, 20, null, () => 1)).toBe(30000))
})
