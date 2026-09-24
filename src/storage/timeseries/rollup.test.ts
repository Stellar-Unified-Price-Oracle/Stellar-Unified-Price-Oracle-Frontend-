import { describe, it, expect } from 'vitest'
import { aggregate, bucketStart, DAY_MS, HOUR_MS, rollupPoints } from './rollup'
import type { TsPoint } from './types'

function point(t: number, v: number, n = 1, meta?: Record<string, unknown>): TsPoint {
  return { series: 's', tier: 'raw', t, v, n, ...(meta ? { meta } : {}) }
}

describe('bucketStart', () => {
  it('floors to the bucket boundary', () => {
    expect(bucketStart(0, HOUR_MS)).toBe(0)
    expect(bucketStart(HOUR_MS - 1, HOUR_MS)).toBe(0)
    expect(bucketStart(HOUR_MS, HOUR_MS)).toBe(HOUR_MS)
    expect(bucketStart(HOUR_MS + 42, HOUR_MS)).toBe(HOUR_MS)
  })
})

describe('aggregate', () => {
  it('counts observation weight', () => {
    expect(aggregate([point(1, 5, 2), point(2, 9, 3)], 'count')).toBe(5)
  })

  it('sums point values', () => {
    expect(aggregate([point(1, 5), point(2, 9)], 'sum')).toBe(14)
  })

  it('returns min and max', () => {
    expect(aggregate([point(1, 5), point(2, 9), point(3, -2)], 'min')).toBe(-2)
    expect(aggregate([point(1, 5), point(2, 9), point(3, -2)], 'max')).toBe(9)
  })

  it('takes the value at the newest timestamp for last', () => {
    expect(aggregate([point(3, -2), point(1, 5), point(2, 9)], 'last')).toBe(-2)
  })

  it('weights avg by observation count', () => {
    // (10*1 + 20*3) / 4 = 17.5
    expect(aggregate([point(1, 10, 1), point(2, 20, 3)], 'avg')).toBeCloseTo(17.5)
  })

  it('is safe on an empty set', () => {
    expect(aggregate([], 'avg')).toBe(0)
    expect(aggregate([], 'count')).toBe(0)
  })
})

describe('rollupPoints', () => {
  it('groups points into fixed buckets and carries the target tier', () => {
    const points = [point(100, 10), point(HOUR_MS + 5, 20), point(HOUR_MS + 10, 30)]
    const rolled = rollupPoints(points, HOUR_MS, 'sum', 'hourly')

    expect(rolled).toHaveLength(2)
    expect(rolled[0]).toMatchObject({ t: 0, tier: 'hourly', v: 10, n: 1 })
    expect(rolled[1]).toMatchObject({ t: HOUR_MS, tier: 'hourly', v: 50, n: 2 })
  })

  it('accumulates n so a re-roll stays weighted correctly', () => {
    const points = [point(0, 10, 4), point(1, 30, 1)]
    const rolled = rollupPoints(points, HOUR_MS, 'avg', 'hourly')
    // (10*4 + 30*1) / 5 = 14
    expect(rolled[0].v).toBeCloseTo(14)
    expect(rolled[0].n).toBe(5)

    // Rolling the hourly point up again into a day keeps the same average.
    const daily = rollupPoints(rolled, DAY_MS, 'avg', 'daily')
    expect(daily[0].v).toBeCloseTo(14)
  })

  it('carries the newest meta within a bucket', () => {
    const points = [point(0, 1, 1, { tag: 'old' }), point(10, 2, 1, { tag: 'new' })]
    const rolled = rollupPoints(points, HOUR_MS, 'max', 'hourly')
    expect(rolled[0].meta).toEqual({ tag: 'new' })
  })

  it('returns an empty array for no input', () => {
    expect(rollupPoints([], HOUR_MS, 'avg', 'hourly')).toEqual([])
  })
})
