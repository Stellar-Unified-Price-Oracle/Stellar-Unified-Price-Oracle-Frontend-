import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `applyHighContrastStyles` used to append a `<style>` element with
 * `textContent`, which the `style-src-elem 'self'` policy in vercel.json treats
 * as inline CSS and blocks. It now prefers a constructable stylesheet, which
 * `style-src` does not govern.
 */

/** Minimal stand-in whose `replaceSync` lives on the prototype, like the real one. */
class FakeConstructableStyleSheet {
  replaceSync(_css: string): void {}
}

function stubConstructableSupport(): void {
  vi.stubGlobal('CSSStyleSheet', FakeConstructableStyleSheet)
  Object.defineProperty(document, 'adoptedStyleSheets', {
    value: [],
    writable: true,
    configurable: true,
  })
}

function removeAppliedStyles(): void {
  document.querySelectorAll('#hc-styles').forEach((element) => element.remove())
  if ('adoptedStyleSheets' in document) document.adoptedStyleSheets = []
}

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  removeAppliedStyles()
  if ('adoptedStyleSheets' in document) {
    delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
  }
})

describe('applyHighContrastStyles', () => {
  it('adopts a constructable stylesheet and never injects an inline <style>', async () => {
    stubConstructableSupport()
    const { applyHighContrastStyles } = await import('./highContrastStyles')

    applyHighContrastStyles()

    expect(document.querySelectorAll('#hc-styles')).toHaveLength(0)
    expect(document.adoptedStyleSheets).toHaveLength(1)
  })

  it('is idempotent', async () => {
    stubConstructableSupport()
    const { applyHighContrastStyles } = await import('./highContrastStyles')

    applyHighContrastStyles()
    applyHighContrastStyles()

    expect(document.adoptedStyleSheets).toHaveLength(1)
  })

  it('falls back to a <style> element where constructable stylesheets are unsupported', async () => {
    vi.stubGlobal('CSSStyleSheet', undefined)
    const { applyHighContrastStyles, HIGH_CONTRAST_CSS } = await import('./highContrastStyles')

    applyHighContrastStyles()
    applyHighContrastStyles()

    const styleElements = document.querySelectorAll('#hc-styles')
    expect(styleElements).toHaveLength(1)
    expect(styleElements[0].textContent).toBe(HIGH_CONTRAST_CSS)
  })

  it('does nothing when there is no document', async () => {
    const { applyHighContrastStyles } = await import('./highContrastStyles')
    vi.stubGlobal('document', undefined)

    expect(() => applyHighContrastStyles()).not.toThrow()
  })
})
