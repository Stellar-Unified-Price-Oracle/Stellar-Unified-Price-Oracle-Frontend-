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

// SVGPathElement.getTotalLength is not implemented in jsdom (used by Recharts)
if (typeof SVGPathElement !== 'undefined' && !SVGPathElement.prototype.getTotalLength) {
  SVGPathElement.prototype.getTotalLength = () => 0
}

// Mock fetch globally so components that call the REST API in unit tests
// don't fail with "fetch is not defined".
// Individual tests can override this with vi.spyOn(global, 'fetch') as needed.
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ pair: '', history: [] }),
  text: async () => '',
} as unknown as Response)

