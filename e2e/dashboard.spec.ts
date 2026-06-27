import { test, expect } from '@playwright/test'

test('dashboard page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
})

test('dashboard renders price cards or empty state', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const cards = page.locator('[aria-label="Price feeds"]')
  const empty = page.getByText('No price feeds available')
  const errorBanner = page.getByRole('alert')
  await expect(cards.or(empty).or(errorBanner).first()).toBeVisible({ timeout: 10_000 })
})

test('search input is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: 'Search by asset pair' })).toBeVisible()
})

test('404 page renders for unknown routes', async ({ page }) => {
  await page.goto('/unknown-route-xyz')
  await expect(page.getByRole('heading', { name: /404|not found/i })).toBeVisible()
})
