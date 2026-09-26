import { describe, it, expect } from 'vitest'
import { DeliveryTracker, backoffMs } from './deliveryReceipts'

const t = () => new DeliveryTracker(async () => {}, () => 1, 3)

describe('DeliveryTracker', () => {
  it('delivers on 2xx', async () => {
    const r = await t().deliver('a', 'webhook', async () => ({ status: 204 }))
    expect(r.status).toBe('delivered')
  })
  it('retries non-2xx then dead-letters and flags channel', async () => {
    const tr = t()
    let calls = 0
    for (const id of ['a', 'b', 'c']) await tr.deliver(id, 'webhook', async () => (calls++, { status: 500 }))
    expect(calls).toBe(9)
    expect(tr.getDeadLetters()).toHaveLength(3)
    expect(tr.getDeadLetters()[0].lastError).toBe('HTTP 500')
    expect(tr.getFailingChannels()).toEqual(['webhook'])
  })
  it('recovers after a retry', async () => {
    let n = 0
    const r = await t().deliver('a', 'email', async () => ({ status: ++n < 2 ? 503 : 200 }))
    expect(r.status).toBe('delivered')
    expect(r.attempts).toBe(2)
    expect(backoffMs(3)).toBe(2000)
  })
})
