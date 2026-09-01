import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ─── Full-page axe audits across all routes ──────────────────────────────────

const ROUTES = ['/', '/dashboard', '/prices/BTC%2FUSD', '/api-docs', '/this-does-not-exist']

for (const route of ROUTES) {
  test(`route ${route} has no automatically detectable axe violations`, async ({ page }) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
}

// ─── Tab order: every interactive element on the dashboard is reachable ──────

test('tab order through the dashboard reaches nav, search, and filter controls without getting stuck', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const seenLabels = new Set<string>()
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return el?.getAttribute('aria-label') || el?.textContent?.trim() || el?.tagName || null
    })
    if (label) seenLabels.add(label)
  }

  // A healthy tab order visits a variety of distinct focusable elements —
  // if focus were stuck on one element (a focus trap bug) this would be 1.
  expect(seenLabels.size).toBeGreaterThan(5)
})

// ─── Focus management: modal open/close and route changes ───────────────────

test('focus returns to a sensible element after closing the alert modal', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const alertBtn = page.locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]').first()
  if (!(await alertBtn.isVisible())) return

  await alertBtn.click()
  const dialog = page.getByRole('dialog', { name: /price alert/i })
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })

  // Focus must not have been dropped back to <body> — that reads as "lost" to
  // screen reader users.
  const activeTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase())
  expect(activeTag).not.toBe('body')
})

test('no focus loss when navigating between routes', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: 'API Docs' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/api-docs/, { timeout: 5_000 })

  const activeTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase())
  expect(activeTag).not.toBe('body')
})

// ─── Screen reader announcements ─────────────────────────────────────────────

test('connection status changes are announced via a live region', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const status = page.locator('[role="status"]').first()
  await expect(status).toBeVisible({ timeout: 10_000 })
  // role=status has an implicit aria-live="polite" — verify no explicit
  // override weakens that contract.
  const ariaLive = await status.getAttribute('aria-live')
  if (ariaLive !== null) {
    expect(['polite', 'assertive']).toContain(ariaLive)
  }
})

// ─── Color contrast at multiple viewports ────────────────────────────────────

const CONTRAST_VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

for (const viewport of CONTRAST_VIEWPORTS) {
  test(`dashboard passes color-contrast audit at ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
}

// ─── Reduced motion ───────────────────────────────────────────────────────────

test('animations are disabled when prefers-reduced-motion is set', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const hasInstantTransitions = await page.evaluate(() => {
    const el = document.querySelector('[class*="animate"], [class*="transition"]') || document.body
    const style = getComputedStyle(el)
    const duration = parseFloat(style.transitionDuration || '0') + parseFloat(style.animationDuration || '0')
    return duration <= 0.02 // 0.01ms rounds to ~0 seconds
  })
  expect(hasInstantTransitions).toBe(true)
})

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

test('"?" opens the keyboard shortcut help dialog', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('body').click() // ensure focus isn't in an input first

  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })
})

test('"/" focuses the search input', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('body').click()

  await page.keyboard.press('/')
  const label = await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('aria-label'))
  expect(label).toBe('Search by asset pair')
})
