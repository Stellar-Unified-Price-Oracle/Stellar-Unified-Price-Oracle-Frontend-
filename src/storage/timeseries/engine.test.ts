import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTimeSeriesEngine } from './engine'
import { ALERT_EVENTS_SERIES, PRICE_HISTORY_SERIES, SERIES_IDS } from './config'
import { DAY_MS, HOUR_MS } from './rollup'
import type { SeriesDescriptor } from './types'

/** Fixed clock so compaction/retention boundaries are deterministic. */
let clock = Date.UTC(2026, 0, 10, 12, 0, 0)
const engine = createTimeSeriesEngine({ now: () => clock })

const T = clock

function alert(triggeredAt: number, price = 100, id = `a-${triggeredAt}`) {
  return { id, alertId: 'alert-1', assetPair: 'BTC/USD', triggeredAt, price, escalation: null, retest: null }
}

beforeEach(async () => {
  engine._reset()
  await engine.clearAll()
  clock = Date.UTC(2026, 0, 10, 12, 0, 0)
  engine.register(ALERT_EVENTS_SERIES as SeriesDescriptor<never>)
  engine.register(PRICE_HISTORY_SERIES as SeriesDescriptor<never>)
})

describe('append + query', () => {
  it('stores a raw point and reads it back', async () => {
    await engine.append(SERIES_IDS.alertEvents, alert(T - 1000, 42))
    const points = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'raw' })

    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ series: 'alert-events', tier: 'raw', t: T - 1000, v: 42, n: 1 })
    expect(points[0].meta?.entry).toMatchObject({ price: 42 })
  })

  it('upserts a point at the same timestamp', async () => {
    await engine.append(SERIES_IDS.alertEvents, alert(T - 1000, 1))
    await engine.append(SERIES_IDS.alertEvents, alert(T - 1000, 2))
    const points = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'raw' })
    expect(points).toHaveLength(1)
    expect(points[0].v).toBe(2)
  })

  it('ignores non-finite observations', async () => {
    await engine.append(SERIES_IDS.alertEvents, { ...alert(T - 1), price: Number.NaN })
    const points = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'raw' })
    expect(points).toHaveLength(0)
  })

  it('resolves a family descriptor by prefix', async () => {
    const series = SERIES_IDS.priceHistory('XLM/USD')
    await engine.appendMany(series, [{ timestamp: T - 2000, price: 0.42, confidence: 0.9, sources: ['a', 'b'] }])
    const points = await engine.query({ series, from: 0, to: T, tier: 'raw' })
    expect(points).toHaveLength(1)
    expect(points[0].v).toBe(0.42)
    expect(points[0].meta).toMatchObject({ confidence: 0.9, sourceCount: 2 })
  })

  it('notifies subscribers on write', async () => {
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(SERIES_IDS.alertEvents, listener)

    await engine.append(SERIES_IDS.alertEvents, alert(T - 1000))
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    await engine.append(SERIES_IDS.alertEvents, alert(T - 2000))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('compact', () => {
  it('rolls complete raw buckets into hourly and deletes the raw rows', async () => {
    const hourStart = T - 2 * HOUR_MS
    await engine.appendMany(SERIES_IDS.alertEvents, [
      alert(hourStart + 5 * 60_000),
      alert(hourStart + 35 * 60_000),
      alert(hourStart + HOUR_MS + 10 * 60_000),
      // Exactly on the current (incomplete) hour boundary — must not be rolled.
      alert(T),
    ])

    await engine.compact(SERIES_IDS.alertEvents)

    const hourly = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'hourly' })
    expect(hourly).toHaveLength(2)
    // Alert events roll up as a count of fires.
    expect(hourly[0]).toMatchObject({ t: hourStart, v: 2, n: 2 })
    expect(hourly[1]).toMatchObject({ t: hourStart + HOUR_MS, v: 1, n: 1 })

    const raw = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'raw' })
    expect(raw).toHaveLength(1)
    expect(raw[0].t).toBe(T)
  })

  it('rolls completed hourly buckets into daily', async () => {
    const dayStart = Date.UTC(2026, 0, 8, 0, 0, 0)
    await engine.appendMany(
      SERIES_IDS.alertEvents,
      [0, HOUR_MS, 2 * HOUR_MS].map((offset) => alert(dayStart + offset)),
    )

    await engine.compact(SERIES_IDS.alertEvents)

    const daily = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'daily' })
    expect(daily).toHaveLength(1)
    expect(daily[0]).toMatchObject({ t: dayStart, v: 3, n: 3 })

    const hourly = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'hourly' })
    expect(hourly).toHaveLength(0)
  })

  it('is idempotent — a second pass consumes nothing', async () => {
    await engine.appendMany(SERIES_IDS.alertEvents, [alert(T - 2 * HOUR_MS + 1000)])
    const first = await engine.compact(SERIES_IDS.alertEvents)
    const second = await engine.compact(SERIES_IDS.alertEvents)
    expect(first).toBe(1)
    expect(second).toBe(0)
  })
})

describe('retention', () => {
  it('deletes raw points older than the tier window', async () => {
    const retention: SeriesDescriptor<{ t: number; v: number }> = {
      id: 'tmp',
      retention: { raw: 1000, hourly: 1000, daily: 1000 },
      toObservation: (payload) => payload,
    }
    engine.register(retention as SeriesDescriptor<never>)

    await engine.append('tmp', { t: T - 5 * HOUR_MS, v: 1 })
    await engine.append('tmp', { t: T, v: 2 })

    const removed = await engine.enforceRetention('tmp')
    expect(removed).toBe(1)

    const points = await engine.query({ series: 'tmp', from: 0, to: T, tier: 'raw' })
    expect(points).toHaveLength(1)
    expect(points[0].t).toBe(T)
  })
})

describe('stats', () => {
  it('reports per-tier occupancy and bounds', async () => {
    await engine.appendMany(SERIES_IDS.alertEvents, [alert(T - 2 * HOUR_MS), alert(T)])
    await engine.compact(SERIES_IDS.alertEvents)

    const stats = await engine.stats(SERIES_IDS.alertEvents)
    expect(stats).not.toBeNull()
    expect(stats!.points.hourly).toBe(1)
    expect(stats!.points.raw).toBe(1)
    expect(stats!.oldest).toBe(T - 2 * HOUR_MS)
    expect(stats!.newest).toBe(T)
    expect(stats!.retention.raw).toBe(30 * DAY_MS)
  })
})

describe('clear', () => {
  it('removes every point for one series', async () => {
    await engine.append(SERIES_IDS.alertEvents, alert(T - 1000))
    await engine.clear(SERIES_IDS.alertEvents)
    const points = await engine.query({ series: SERIES_IDS.alertEvents, from: 0, to: T, tier: 'raw' })
    expect(points).toHaveLength(0)
  })
})
