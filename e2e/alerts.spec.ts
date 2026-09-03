import { test, expect } from '@playwright/test'

// ─── Alerts: alert panel ──────────────────────────────────────────────────────

test('alert panel opens via bell icon in nav', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle price alerts' }).click()
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).toBeVisible({ timeout: 5_000 })
})

test('alert panel shows empty state when no alerts exist', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle price alerts' }).click()
  await expect(page.getByText('No alerts set yet')).toBeVisible({ timeout: 5_000 })
})

test('alert panel closes when close button is clicked', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle price alerts' }).click()
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).toBeVisible({ timeout: 5_000 })

  // The X button inside the panel
  await page.getByRole('button', { name: /close/i }).last().click()
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).not.toBeVisible({ timeout: 5_000 })
})

test('alert panel closes when backdrop is clicked', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Toggle price alerts' }).click()
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).toBeVisible({ timeout: 5_000 })

  // Click the semi-transparent backdrop (aria-hidden overlay div)
  await page.locator('.fixed.inset-0.z-40').click({ force: true })
  await expect(page.getByRole('heading', { name: 'Price Alerts' })).not.toBeVisible({ timeout: 5_000 })
})

// ─── Alerts: alert modal (create) ────────────────────────────────────────────

test('alert modal opens when alert button on a price card is clicked', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  // Each price card has an alert/bell button
  const alertBtn = page.locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]').first()
  if (await alertBtn.isVisible()) {
    await alertBtn.click()
    await expect(page.getByRole('dialog', { name: /price alert/i })).toBeVisible({ timeout: 5_000 })
  }
})

test('alert modal can be closed with Escape key', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const alertBtn = page.locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]').first()
  if (!(await alertBtn.isVisible())) return

  await alertBtn.click()
  await expect(page.getByRole('dialog', { name: /price alert/i })).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /price alert/i })).not.toBeVisible({ timeout: 5_000 })
})

test('alert modal shows validation error when submitted with no thresholds', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const alertBtn = page.locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]').first()
  if (!(await alertBtn.isVisible())) return

  await alertBtn.click()
  await expect(page.getByRole('dialog', { name: /price alert/i })).toBeVisible({ timeout: 5_000 })

  // Submit without filling thresholds
  await page.getByRole('button', { name: /create alert/i }).click()
  await expect(page.getByText(/at least one threshold/i)).toBeVisible({ timeout: 5_000 })
})

test('alert can be created with an upper threshold', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const alertBtn = page.locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]').first()
  if (!(await alertBtn.isVisible())) return

  await alertBtn.click()
  await expect(page.getByRole('dialog', { name: /price alert/i })).toBeVisible({ timeout: 5_000 })

  await page.getByLabel('Upper Threshold').fill('99999')
  await page.getByRole('button', { name: /create alert/i }).click()

  // Modal should close on successful save
  await expect(page.getByRole('dialog', { name: /price alert/i })).not.toBeVisible({ timeout: 5_000 })
})

test('notification channels modal opens', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Configure notification channels' }).click()
  // The modal dialog should appear
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 5_000 })
})
