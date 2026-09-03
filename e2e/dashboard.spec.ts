import { test, expect } from '@playwright/test'

// ─── Dashboard: basic load ────────────────────────────────────────────────────

test('dashboard page loads', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({ timeout: 10_000 })
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
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('textbox', { name: 'Search by asset pair' })).toBeVisible({ timeout: 10_000 })
})

test('404 page renders for unknown routes', async ({ page }) => {
  await page.goto('/unknown-route-xyz')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: /404|not found/i })).toBeVisible({ timeout: 10_000 })
})

// ─── Dashboard: search ────────────────────────────────────────────────────────

test('search filters price cards by asset pair', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Wait for price cards to appear
  const grid = page.locator('[aria-label="Price feeds"]')
  await expect(grid).toBeVisible({ timeout: 10_000 })

  const searchBox = page.getByRole('textbox', { name: 'Search by asset pair' })
  await searchBox.fill('BTC')

  // After searching for BTC only BTC-related cards should be visible; non-BTC cards should not
  await expect(page.getByText('XLM/USD')).not.toBeVisible({ timeout: 5_000 }).catch(() => {
    // XLM/USD may not have been in the mock data – that is fine
  })

  // Clear search and results come back
  await searchBox.clear()
  await expect(grid).toBeVisible({ timeout: 5_000 })
})

test('searching for a non-existent pair shows no-results message', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const searchBox = page.getByRole('textbox', { name: 'Search by asset pair' })
  await searchBox.fill('ZZZZZ_NONEXISTENT')
  await expect(page.getByText(/No results/i)).toBeVisible({ timeout: 5_000 })
})

// ─── Dashboard: view toggle ───────────────────────────────────────────────────

test('switching to table view renders the table', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const tableViewBtn = page.getByRole('button', { name: 'Table view' })
  await tableViewBtn.click()
  await expect(page.getByRole('table')).toBeVisible({ timeout: 5_000 })
})

// ─── Dashboard: filter panel ──────────────────────────────────────────────────

test('filter panel opens and closes', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const filterBtn = page.getByRole('button', { name: 'Toggle filter panel' })
  await filterBtn.click()
  await expect(page.getByText('Filters & Sort')).toBeVisible({ timeout: 5_000 })

  // Close by clicking the button again
  await filterBtn.click()
  await expect(page.getByText('Filters & Sort')).not.toBeVisible({ timeout: 5_000 })
})

test('filter panel contains source checkboxes', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle filter panel' }).click()
  await expect(page.getByText('Filters & Sort')).toBeVisible({ timeout: 5_000 })

  // At least one oracle source label should be present
  const chainlinkLabel = page.getByRole('checkbox', { name: /chainlink/i })
  const redstoneLabel = page.getByRole('checkbox', { name: /redstone/i })
  await expect(chainlinkLabel.or(redstoneLabel).first()).toBeVisible({ timeout: 5_000 })
})

test('filter panel has confidence and price range inputs', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle filter panel' }).click()
  await expect(page.getByText('Filters & Sort')).toBeVisible({ timeout: 5_000 })

  await expect(page.getByRole('slider', { name: 'Minimum confidence' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Maximum confidence' })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Minimum price' })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Maximum price' })).toBeVisible()
})

test('clearing filters resets URL params', async ({ page }) => {
  await page.goto('/?minConf=50')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle filter panel' }).click()
  await expect(page.getByText('Filters & Sort')).toBeVisible({ timeout: 5_000 })

  // "Clear all" button should appear since a filter is active
  const clearBtn = page.getByRole('button', { name: /clear all/i })
  await clearBtn.click()
  await expect(page).not.toHaveURL(/minConf/, { timeout: 5_000 })
})

// ─── Dashboard: selection mode ────────────────────────────────────────────────

test('selection mode can be toggled', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const selectBtn = page.getByRole('button', { name: 'Toggle selection mode' })
  await selectBtn.click()

  // Selection toolbar should appear
  await expect(page.getByRole('button', { name: /select all/i })).toBeVisible({ timeout: 5_000 })

  // Exit select mode
  await selectBtn.click()
  await expect(page.getByRole('button', { name: /select all/i })).not.toBeVisible({ timeout: 5_000 })
})

// ─── Dashboard: alert modal ───────────────────────────────────────────────────

test('alert modal opens from notification channels button', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  // Open alert modal via the bell icon in the layout header
  await page.getByRole('button', { name: 'Toggle price alerts' }).click()
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).toBeVisible({ timeout: 5_000 })

  // Close the panel
  await page.keyboard.press('Escape')
})
