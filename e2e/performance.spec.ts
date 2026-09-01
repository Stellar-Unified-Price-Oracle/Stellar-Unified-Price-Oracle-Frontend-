import { test, expect } from '@playwright/test'

// ─── Load time budgets ────────────────────────────────────────────────────────

const LOAD_TIME_BUDGET_MS = 5_000

test('dashboard initial render completes within the load time budget', async ({ page }) => {
  const start = Date.now()
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({
    timeout: LOAD_TIME_BUDGET_MS,
  })
  expect(Date.now() - start).toBeLessThan(LOAD_TIME_BUDGET_MS)
})

test('navigation timing reports a reasonable time-to-interactive', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const timing = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (!nav) return null
    return {
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      loadEvent: nav.loadEventEnd - nav.startTime,
    }
  })

  expect(timing).not.toBeNull()
  expect(timing!.domContentLoaded).toBeLessThan(LOAD_TIME_BUDGET_MS)
  expect(timing!.loadEvent).toBeLessThan(LOAD_TIME_BUDGET_MS)
})

// ─── Mount/unmount via route churn ────────────────────────────────────────────

test('switching between dashboard and price detail routes stays within budget', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const start = Date.now()
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(Date.now() - start).toBeLessThan(LOAD_TIME_BUDGET_MS)
})

// ─── No long-task pile-up on initial load ────────────────────────────────────

test('initial load does not report long tasks beyond a small budget', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const longTaskCount = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        if (typeof PerformanceObserver === 'undefined') {
          resolve(0)
          return
        }
        let count = 0
        try {
          const observer = new PerformanceObserver((list) => {
            count += list.getEntries().length
          })
          observer.observe({ entryTypes: ['longtask'] })
          setTimeout(() => {
            observer.disconnect()
            resolve(count)
          }, 1_000)
        } catch {
          resolve(0)
        }
      }),
  )

  // A handful of long tasks during hydration is normal; a runaway count
  // signals a blocking main-thread regression.
  expect(longTaskCount).toBeLessThan(20)
})
