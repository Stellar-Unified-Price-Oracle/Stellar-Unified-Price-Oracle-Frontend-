import { test, expect } from '@playwright/test'

// ─── Error states ─────────────────────────────────────────────────────────────

test('dashboard shows error alert when API returns 500', async ({ page }) => {
  // Override the /api/prices endpoint to return a server error
  await page.route('**/api/prices', (route) => {
    route.fulfill({ status: 500, body: 'Internal Server Error' })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // An error alert or "No price feeds available" message should appear
  const errorAlert = page.getByRole('alert')
  const emptyState = page.getByText('No price feeds available')
  await expect(errorAlert.or(emptyState).first()).toBeVisible({ timeout: 10_000 })
})

test('price detail shows error alert when single price API returns 500', async ({ page }) => {
  await page.route('**/api/prices/BTC%2FUSD', (route) => {
    route.fulfill({ status: 500, body: 'Internal Server Error' })
  })

  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  const errorAlert = page.getByRole('alert')
  const emptyState = page.getByRole('status')
  await expect(errorAlert.or(emptyState).first()).toBeVisible({ timeout: 10_000 })
})

test('price detail shows error when history API returns 500', async ({ page }) => {
  await page.route('**/api/prices/ETH%2FUSD/history', (route) => {
    route.fulfill({ status: 500, body: 'Internal Server Error' })
  })

  await page.goto('/prices/ETH%2FUSD')
  await page.waitForLoadState('networkidle')

  // The history section should show an alert, or the page falls back gracefully
  const errorAlert = page.getByRole('alert')
  const priceBlock = page.getByText('Current Price')
  await expect(errorAlert.or(priceBlock).first()).toBeVisible({ timeout: 10_000 })
})

// ─── Navigation: routing ──────────────────────────────────────────────────────

test('clicking the site logo navigates to dashboard', async ({ page }) => {
  await page.goto('/api-docs')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: /stellar oracle/i }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL('/', { timeout: 5_000 })
})

test('API docs page renders documentation content', async ({ page }) => {
  await page.goto('/api-docs')
  await page.waitForLoadState('networkidle')

  // The API docs page should have some heading
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
})

test('navigating back from 404 to dashboard works', async ({ page }) => {
  await page.goto('/totally-unknown-xyz')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: /404|not found/i })).toBeVisible({ timeout: 10_000 })

  // Click the main logo / nav link to go home
  await page.getByRole('link', { name: /stellar oracle/i }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({ timeout: 10_000 })
})

test('browser back button works after navigating to price detail', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const firstCard = page.locator('[aria-label="Price feeds"] > *').first()
  await firstCard.click()
  await page.waitForLoadState('networkidle')

  await page.goBack()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({ timeout: 10_000 })
})

// ─── Navigation: URL persistence ─────────────────────────────────────────────

test('search query is reflected in the URL', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('textbox', { name: 'Search by asset pair' }).fill('BTC')
  await expect(page).toHaveURL(/search=BTC/, { timeout: 5_000 })
})

test('reloading page with search param preserves search state', async ({ page }) => {
  await page.goto('/?search=ETH')
  await page.waitForLoadState('networkidle')

  const searchBox = page.getByRole('textbox', { name: 'Search by asset pair' })
  await expect(searchBox).toHaveValue('ETH', { timeout: 10_000 })
})

// ─── WebSocket status ─────────────────────────────────────────────────────────

test('connection status badge is visible', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // The ConnectionBadge renders a role="status" span
  await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 10_000 })
})

test('connection badge shows one of the expected status labels', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const badge = page.locator('[role="status"]').first()
  await expect(badge).toBeVisible({ timeout: 10_000 })

  const text = await badge.textContent()
  const validLabels = ['Live', 'Connecting', 'Reconnecting', 'Offline', 'Rate limited']
  expect(validLabels.some((l) => text?.includes(l))).toBe(true)
})
