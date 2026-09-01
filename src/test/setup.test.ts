import { describe, it, expect } from 'vitest'

/**
 * Guards the jsdom SVG polyfills installed in setup.ts.
 *
 * jsdom implements neither SVGPathElement nor getTotalLength — a freshly created
 * <path> is a plain SVGElement whose getTotalLength is undefined. Recharts calls
 * getTotalLength while animating its line/area paths, so the missing method would
 * throw "getTotalLength is not a function" in any test that renders an animated chart.
 */
describe('jsdom SVG setup', () => {
  it('exposes a getTotalLength stub on SVG path elements', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path') as SVGElement & {
      getTotalLength: () => number
    }

    expect(typeof path.getTotalLength).toBe('function')
    expect(path.getTotalLength()).toBe(0)
  })

  it('exposes a getTotalLength stub on SVG line elements', () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line') as SVGElement & {
      getTotalLength: () => number
    }

    expect(typeof line.getTotalLength).toBe('function')
    expect(line.getTotalLength()).toBe(0)
  })
})
