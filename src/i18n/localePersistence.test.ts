import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * A worker-update reload re-runs the app from scratch. The chosen language must
 * come back on that reload, with the matching document direction (#834). This
 * test reloads the i18n module the way a page load does, with only storage kept.
 */
async function reloadApp() {
  vi.resetModules()
  const mod = await import('./index')
  return mod.default
}

describe('locale preference across reloads', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.dir = ''
    vi.resetModules()
  })

  it('restores a saved right-to-left language and its direction', async () => {
    const first = await reloadApp()
    await first.changeLanguage('ar')
    expect(localStorage.getItem('i18nextLng')).toBe('ar')

    const reloaded = await reloadApp()

    expect(reloaded.language).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('restores a saved left-to-right language and resets direction', async () => {
    const first = await reloadApp()
    await first.changeLanguage('ar')
    await first.changeLanguage('fr')

    const reloaded = await reloadApp()

    expect(reloaded.language).toBe('fr')
    expect(document.documentElement.dir).toBe('ltr')
  })
})
