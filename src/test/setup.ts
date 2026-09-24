import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { toHaveNoViolations } from 'vitest-axe/dist/matchers.js'
import { afterEach, expect, vi } from 'vitest'
// IndexedDB is not implemented in jsdom. fake-indexeddb provides an in-memory
// implementation so preference persistence, the offline price cache, and the
// idb migration runner can all be exercised in unit tests.
import 'fake-indexeddb/auto'
// Initialise i18n with English translations so all components render real strings
// (not raw keys like "notFound.heading") during unit tests.
import '../i18n'

expect.extend({ toHaveNoViolations })

// Testing Library's auto-cleanup only runs when `globals: true` is set, which
// this config does not use. Without it, components rendered in one test stay in
// the DOM for the next, producing duplicate-element query failures. Unmount
// after every test explicitly.
afterEach(() => {
  cleanup()
})

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

// jsdom's getContext exists but throws "Not implemented" when called, which
// axe-core touches during color-contrast checks (and the canvas chart engine
// uses at runtime). Override it unconditionally with a minimal 2D context so
// neither axe nor CanvasChart crashes in tests. The proxy returns no-op
// functions for any method and a fixed width from measureText.
if (typeof HTMLCanvasElement !== 'undefined') {
  const noop = () => {}
  const ctxStub = new Proxy(
    {
      measureText: () => ({ width: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string]
        return noop
      },
      set() {
        return true
      },
    },
  )
  HTMLCanvasElement.prototype.getContext = (() => ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

// jsdom does not implement scrollIntoView, which CommandPalette calls to keep the
// highlighted item in view while arrowing through results.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Mock fetch globally so components that call the REST API in unit tests
// don't fail with "fetch is not defined".
// Individual tests can override this with vi.spyOn(global, 'fetch') as needed.
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ pair: '', history: [] }),
  text: async () => '',
} as unknown as Response)

// jsdom's getComputedStyle throws "Not implemented" when a pseudo-element
// argument is passed, which axe-core's color-contrast check does. Delegate to
// the plain-element path in that case so axe can run in unit tests.
const originalGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((elt: Element, _pseudoElt?: string | null) => {
  return originalGetComputedStyle(elt)
}) as typeof window.getComputedStyle
