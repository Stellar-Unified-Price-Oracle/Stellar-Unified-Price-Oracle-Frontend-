import { describe, it, expect } from 'vitest'
import { computeCohorts, type DeveloperEvent } from './developerCohorts'

const W = 7 * 24 * 3600 * 1000
const ev = (id: string, t: number, feature: DeveloperEvent['feature'] = 'docs_view'): DeveloperEvent => ({ anonId: id, timestamp: t, feature })

describe('computeCohorts', () => {
  it('computes retention and adoption for a large cohort', () => {
    const events: DeveloperEvent[] = []
    for (let i = 0; i < 10; i++) events.push(ev(`u${i}`, 10 * W))
    for (let i = 0; i < 5; i++) events.push(ev(`u${i}`, 11 * W + 1, 'key_create'))
    const [c] = computeCohorts(events, 11 * W + 5)
    expect(c.size).toBe(10)
    expect(c.retention).toEqual([1, 0.5])
    expect(c.adoption.docs_view).toBe(1)
    expect(c.adoption.key_create).toBe(0.5)
    expect(c.adoption.webhook_config).toBe(0)
  })
  it('suppresses low-sample cohorts', () => {
    const [c] = computeCohorts([ev('a', W), ev('b', W)], 2 * W)
    expect(c.suppressed).toBe(true)
    expect(c.retention.every((r) => r === null)).toBe(true)
    expect(c.adoption.docs_view).toBeNull()
  })
})
