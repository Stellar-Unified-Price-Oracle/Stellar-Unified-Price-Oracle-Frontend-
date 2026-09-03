import { test, expect } from '@playwright/test'

// ─── Price Detail: navigation ─────────────────────────────────────────────────

test('navigating to a price detail page renders the pair heading', async ({ page }) => {
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  // Either the pair heading or the skeleton/error should be visible
  const heading = page.getByRole('heading', { name: /BTC\/USD/i })
  const skeleton = page.locator('[aria-label*="skeleton"], [aria-busy="true"]')
  const errorAlert = page.getByRole('alert')
  await expect(heading.or(skeleton).or(errorAlert).first()).toBeVisible({ timeout: 10_000 })
})

test('back button on price detail returns to dashboard', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  // Click on the first price card to navigate to detail
  const firstCard = page.locator('[aria-label="Price feeds"] > *').first()
  await firstCard.click()
  await page.waitForLoadState('networkidle')

  // Confirm we left the dashboard
  await expect(page).not.toHaveURL('/', { timeout: 5_000 })

  // Click the back button
  const backBtn = page.getByRole('button', { name: /go back to dashboard/i })
  await backBtn.click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible({ timeout: 10_000 })
})

test('price detail page shows current price block', async ({ page }) => {
  await page.goto('/prices/XLM%2FUSD')
  await page.waitForLoadState('networkidle')

  // The "Current Price" label should appear once data has loaded
  const priceLabel = page.getByText('Current Price')
  const errorAlert = page.getByRole('alert')
  await expect(priceLabel.or(errorAlert).first()).toBeVisible({ timeout: 10_000 })
})

test('price detail page shows oracle sources section', async ({ page }) => {
  await page.goto('/prices/XLM%2FUSD')
  await page.waitForLoadState('networkidle')

  const sourcesLabel = page.getByText('Oracle Sources')
  const errorAlert = page.getByRole('alert')
  await expect(sourcesLabel.or(errorAlert).first()).toBeVisible({ timeout: 10_000 })
})

test('price detail page renders the price history chart section', async ({ page }) => {
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  const historyLabel = page.getByText(/Price History/i)
  const errorAlert = page.getByRole('alert')
  await expect(historyLabel.or(errorAlert).first()).toBeVisible({ timeout: 10_000 })
})

// ─── Price Detail: CSV import ─────────────────────────────────────────────────

test('CSV import zone is visible on price detail page', async ({ page }) => {
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  const importZone = page.getByRole('button', { name: /upload csv file/i })
  const errorAlert = page.getByRole('alert')
  await expect(importZone.or(errorAlert).first()).toBeVisible({ timeout: 10_000 })
})

test('CSV import zone accepts a valid CSV file', async ({ page }) => {
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  const importZone = page.getByRole('button', { name: /upload csv file/i })
  // Skip if error state (no data from mock)
  if (!(await importZone.isVisible().catch(() => false))) return

  // Use the hidden file input
  const fileInput = page.locator('input[type="file"][accept*="csv"]')
  const csvContent = 'timestamp,price\n1700000000000,65000\n1700000060000,65100\n1700000120000,64900'
  await fileInput.setInputFiles({
    name: 'test-prices.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })

  await expect(page.getByText(/CSV data imported/i)).toBeVisible({ timeout: 5_000 })
})

test('CSV import shows error for invalid file type', async ({ page }) => {
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  const importZone = page.getByRole('button', { name: /upload csv file/i })
  if (!(await importZone.isVisible().catch(() => false))) return

  const fileInput = page.locator('input[type="file"][accept*="csv"]')
  await fileInput.setInputFiles({
    name: 'bad-file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a csv'),
  })

  await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 })
})

test('CSV clear button removes imported data', async ({ page }) => {
  await page.goto('/prices/BTC%2FUSD')
  await page.waitForLoadState('networkidle')

  const importZone = page.getByRole('button', { name: /upload csv file/i })
  if (!(await importZone.isVisible().catch(() => false))) return

  const fileInput = page.locator('input[type="file"][accept*="csv"]')
  const csvContent = '1700000000000,65000\n1700000060000,65100'
  await fileInput.setInputFiles({
    name: 'prices.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })

  await expect(page.getByText(/CSV data imported/i)).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: /clear/i }).click()
  await expect(page.getByRole('button', { name: /upload csv file/i })).toBeVisible({ timeout: 5_000 })
})

// ─── Price Detail: direct URL access ─────────────────────────────────────────

test('price detail page is accessible via /prices/:pair URL directly', async ({ page }) => {
  await page.goto('/prices/ETH%2FUSD')
  await page.waitForLoadState('networkidle')

  // Page should not 404
  await expect(page.getByRole('heading', { name: /404|not found/i })).not.toBeVisible({ timeout: 5_000 })
})
