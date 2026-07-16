import '@testing-library/jest-dom/vitest'
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js'
import { expect, vi } from 'vitest'

expect.extend({ toHaveNoViolations })

class ResizeObserverMock {
  observe = () => {}
  unobserve = () => {}
  disconnect = () => {}
}

window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// matchMedia is not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom implements neither SVGPathElement nor getTotalLength, which Recharts calls on
// its <path> nodes while animating lines and areas. Depending on the jsdom version a
// <path> is an instance of SVGPathElement, SVGGeometryElement, or just the base
// SVGElement (the current case — the more specific classes are `undefined`), so install
// the stub on whichever prototypes exist. The previous guard keyed off SVGPathElement,
// which is undefined here, so the mock never applied. (SVGElement's type does not declare
// getTotalLength, hence the cast.)
function mockGetTotalLength(ctor: { prototype: object } | undefined): void {
  if (!ctor) return
  const proto = ctor.prototype as { getTotalLength?: () => number }
  if (typeof proto.getTotalLength !== 'function') {
    proto.getTotalLength = () => 0
  }
}

mockGetTotalLength(typeof SVGElement !== 'undefined' ? SVGElement : undefined)
mockGetTotalLength(typeof SVGGeometryElement !== 'undefined' ? SVGGeometryElement : undefined)
mockGetTotalLength(typeof SVGPathElement !== 'undefined' ? SVGPathElement : undefined)

// Mock fetch globally so components that call the REST API in unit tests
// don't fail with "fetch is not defined".
// Individual tests can override this with vi.spyOn(global, 'fetch') as needed.
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ pair: '', history: [] }),
  text: async () => '',
} as unknown as Response)
