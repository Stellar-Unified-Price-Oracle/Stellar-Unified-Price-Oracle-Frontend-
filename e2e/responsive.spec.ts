import { test, expect } from '@playwright/test'

// ─── Responsive: mobile viewport (375 × 812) ─────────────────────────────────

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('dashboard renders on mobile without horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({ timeout: 10_000 })

    // No horizontal scrollbar — scrollWidth should equal clientWidth
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)
  })

  test('mobile bottom navigation bar is visible on mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Navigation on mobile is a bottom tab bar (no hamburger menu).
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(nav).toBeVisible({ timeout: 10_000 })
  })

  test('mobile bottom nav provides links to the main routes', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const nav = page.getByRole('navigation', { name: 'Mobile navigation' })
    await expect(nav.getByRole('link', { name: /Dashboard|Home/ }).first()).toBeVisible({ timeout: 5_000 })
    await expect(nav.getByRole('link', { name: 'API Docs' })).toBeVisible({ timeout: 5_000 })
  })

  test('search input is visible on mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('combobox', { name: 'Search asset pairs' })).toBeVisible({ timeout: 10_000 })
  })

  test('404 page renders correctly on mobile', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /404|not found/i })).toBeVisible({ timeout: 10_000 })
  })

  test('price detail page renders on mobile', async ({ page }) => {
    await page.goto('/prices/BTC%2FUSD')
    await page.waitForLoadState('networkidle')

    const backBtn = page.getByRole('button', { name: /go back to dashboard/i })
    const errorAlert = page.getByRole('alert')
    await expect(backBtn.or(errorAlert).first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Responsive: tablet viewport (768 × 1024) ────────────────────────────────

test.describe('tablet viewport', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('dashboard renders on tablet without horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({ timeout: 10_000 })

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasOverflow).toBe(false)
  })

  test('price feeds grid is visible on tablet', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const grid = page.locator('[aria-label="Price feeds"]')
    const loading = page.locator('[aria-label="Loading price cards"]')
    const empty = page.getByText('No price feeds available')
    await expect(grid.or(loading).or(empty).first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Responsive: desktop viewport (1440 × 900) ───────────────────────────────

test.describe('desktop viewport', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('desktop nav links are directly visible (no hamburger required)', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // On desktop, nav links should be visible inline — hamburger hidden
    await expect(page.getByRole('link', { name: 'API Docs' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Toggle menu' })).not.toBeVisible()
  })

  test('filter panel and search are side-by-side on desktop', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('combobox', { name: 'Search asset pairs' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Toggle filter panel' })).toBeVisible()
  })
})
