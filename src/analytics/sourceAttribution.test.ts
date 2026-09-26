import { describe, it, expect } from 'vitest'
import { attributeSources, type SourceObservation } from './sourceAttribution'

const NOW = 1_000_000
const o = (source: string, t: number, price: number | null, latencyMs = 100): SourceObservation => ({
  source, timestamp: t, price, aggregate: 100, latencyMs,
})

describe('attributeSources', () => {
  const obs = [
    o('a', 900_000, 100), o('a', 950_000, 100.1),
    o('b', 900_000, 103), o('b', 950_000, null),
    o('old', 1, 100),
  ]
  it('ranks by accuracy/uptime and ignores out-of-window data', () => {
    const r = attributeSources(obs, 200_000, NOW)
    expect(r.map((x) => x.source)).toEqual(['a', 'b'])
    expect(r[1].uptimePct).toBe(50)
    expect(r[0].rank).toBe(1)
  })
  it('is reproducible', () => {
    expect(attributeSources(obs, 200_000, NOW)).toEqual(attributeSources([...obs].reverse(), 200_000, NOW))
  })
  it('handles empty input', () => {
    expect(attributeSources([], 10, NOW)).toEqual([])
  })
})
