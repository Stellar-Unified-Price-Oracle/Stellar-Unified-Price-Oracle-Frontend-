import { describe, it, expect } from 'vitest'
import { laplace, gaussian, randomizedResponse, exponential } from './noise'

describe('laplace', () => {
  it('throws for non-positive epsilon', () => {
    expect(() => laplace(1, 1, 0)).toThrow(RangeError)
    expect(() => laplace(1, 1, -1)).toThrow(RangeError)
  })

  it('returns a finite number', () => {
    for (let i = 0; i < 20; i++) {
      expect(isFinite(laplace(1, 1, 1))).toBe(true)
    }
  })

  it('is approximately centred on the true value over many samples (LLN)', () => {
    const N = 10_000
    const values = Array.from({ length: N }, () => laplace(1, 1, 1))
    const mean = values.reduce((a, b) => a + b, 0) / N
    // With epsilon=1, std≈1.41; CI for mean with N=10000 is very tight
    expect(mean).toBeGreaterThan(0.9)
    expect(mean).toBeLessThan(1.1)
  })
})

describe('gaussian', () => {
  it('throws for invalid epsilon or delta', () => {
    expect(() => gaussian(0, 1, 0, 1e-5)).toThrow(RangeError)
    expect(() => gaussian(0, 1, 1, 0)).toThrow(RangeError)
    expect(() => gaussian(0, 1, 1, 1)).toThrow(RangeError)
  })

  it('returns a finite number', () => {
    for (let i = 0; i < 20; i++) {
      expect(isFinite(gaussian(0, 1, 1, 1e-5))).toBe(true)
    }
  })
})

describe('randomizedResponse', () => {
  it('throws for non-positive epsilon', () => {
    expect(() => randomizedResponse(true, 0)).toThrow(RangeError)
  })

  it('returns a boolean', () => {
    expect(typeof randomizedResponse(true, 2)).toBe('boolean')
    expect(typeof randomizedResponse(false, 2)).toBe('boolean')
  })

  it('is accurate for large epsilon (rarely flips)', () => {
    // epsilon=10 → p ≈ 0.99995
    const flips = Array.from({ length: 1000 }, () => randomizedResponse(true, 10)).filter((v) => !v).length
    expect(flips).toBeLessThan(20)
  })
})

describe('exponential', () => {
  it('throws for invalid inputs', () => {
    expect(() => exponential([], 1, 1)).toThrow(RangeError)
    expect(() => exponential([1, 2], 1, 0)).toThrow(RangeError)
  })

  it('returns a valid index', () => {
    const idx = exponential([1, 5, 2], 1, 2)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(3)
  })

  it('favours the highest-scored option for large epsilon', () => {
    const wins = Array.from({ length: 200 }, () => exponential([1, 100, 2], 1, 10)).filter((i) => i === 1).length
    expect(wins).toBeGreaterThan(180)
  })
})
