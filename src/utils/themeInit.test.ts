// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `public/theme-init.js` runs before React and applies the theme class that
 * prevents a flash of the wrong theme. It cannot import from src, so this test
 * runs it against jsdom and pins its results to the rules in useTheme (#834).
 */
const SCRIPT = readFileSync(resolve(process.cwd(), 'public/theme-init.js'), 'utf8')

function runThemeInit(stored: string | null, prefersDark: boolean): boolean {
  localStorage.clear()
  if (stored !== null) localStorage.setItem('stellar-oracle-theme', stored)
  document.documentElement.className = ''
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: prefersDark && query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  new Function(SCRIPT)()
  return document.documentElement.classList.contains('dark')
}

describe('theme-init pre-paint script', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it.each([
    ['dark', false, true],
    ['dark', true, true],
    ['light', true, false],
    ['light', false, false],
  ])('an explicit stored %s theme ignores the OS (prefersDark=%s)', (stored, prefersDark, expected) => {
    expect(runThemeInit(stored, prefersDark)).toBe(expected)
  })

  it.each([
    ['system', true, true],
    ['system', false, false],
  ])('a stored "system" choice follows the OS preference (prefersDark=%s)', (stored, prefersDark, expected) => {
    expect(runThemeInit(stored, prefersDark)).toBe(expected)
  })

  it.each([
    [true, true],
    [false, false],
  ])('with nothing stored, follows the OS preference (prefersDark=%s)', (prefersDark, expected) => {
    expect(runThemeInit(null, prefersDark)).toBe(expected)
  })

  it('falls back to the OS preference when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied')
    })
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))

    expect(() => new Function(SCRIPT)()).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
