/**
 * Offline-launch recovery matrix (#833).
 *
 * For each route the app serves offline, these tests check what a user sees when
 * they launch or reload while offline, and that the app recovers once the
 * connection returns. The service worker is Chromium-verified here, as in
 * pwa.spec.ts, because the lifecycle it depends on is not uniform across browsers.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const ROUTES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'price detail', path: '/price/XLM%2FUSD' },
  { name: 'portfolio', path: '/portfolio' },
] as const

const OFFLINE_HEADING = "You're offline"

/** Loads the route online and waits until the service worker controls the page. */
async function warmRoute(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('main')).toBeVisible()
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)), {
      timeout: 15_000,
    })
    .toBe(true)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
}

async function expectOfflineFallback(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: OFFLINE_HEADING })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
}

async function goOffline(context: BrowserContext, page: Page): Promise<void> {
  await context.setOffline(true)
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
}

test.describe('Offline-launch recovery matrix', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Service worker lifecycle is verified in Chromium')
  })

  for (const route of ROUTES) {
    test.describe(route.name, () => {
      test('a reload while offline shows the offline fallback, not a blank page', async ({ context, page }) => {
        await warmRoute(page, route.path)
        await goOffline(context, page)

        await page.reload()

        await expectOfflineFallback(page)
      })

      test('a page that is already open keeps rendering when the connection drops', async ({ context, page }) => {
        await warmRoute(page, route.path)
        await goOffline(context, page)

        await expect(page.getByRole('main')).toBeVisible()
        await expect(page.getByRole('heading', { name: OFFLINE_HEADING })).toHaveCount(0)
      })

      test('retrying while still offline keeps the fallback in place', async ({ context, page }) => {
        await warmRoute(page, route.path)
        await goOffline(context, page)
        await page.reload()
        await expectOfflineFallback(page)

        await page.getByRole('button', { name: 'Retry' }).click()

        await expectOfflineFallback(page)
      })

      test('going back online and retrying restores the live route', async ({ context, page }) => {
        await warmRoute(page, route.path)
        await goOffline(context, page)
        await page.reload()
        await expectOfflineFallback(page)

        await context.setOffline(false)
        await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true)
        await page.getByRole('button', { name: 'Retry' }).click()

        await expect(page.getByRole('heading', { name: OFFLINE_HEADING })).toHaveCount(0)
        await expect(page.getByRole('main')).toBeVisible()
        expect(new URL(page.url()).pathname).toBe(route.path)
      })
    })
  }
})
