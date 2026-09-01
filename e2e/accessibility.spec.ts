import { test, expect } from '@playwright/test'

// ─── Accessibility: keyboard navigation ──────────────────────────────────────

test('main navigation links are reachable via Tab', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Tab from body into the nav
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')

  // At least one focused element should be a nav link
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase())
  expect(['a', 'button', 'input']).toContain(focusedTag)
})

test('search input is reachable via Tab', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Tab through nav items to reach the search box
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('aria-label'))
    if (label === 'Search by asset pair') break
  }

  const label = await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('aria-label'))
  expect(label).toBe('Search by asset pair')
})

test('filter toggle button has correct aria-pressed state', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const filterBtn = page.getByRole('button', { name: 'Toggle filter panel' })
  await expect(filterBtn).toHaveAttribute('aria-pressed', 'false')

  await filterBtn.click()
  await expect(filterBtn).toHaveAttribute('aria-pressed', 'true')

  await filterBtn.click()
  await expect(filterBtn).toHaveAttribute('aria-pressed', 'false')
})

test('alert modal traps focus inside dialog', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const alertBtn = page.locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]').first()
  if (!(await alertBtn.isVisible())) return

  await alertBtn.click()
  const dialog = page.getByRole('dialog', { name: /price alert/i })
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  // Tab several times — focus should remain within the dialog
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const isInsideDialog = await page.evaluate(() => {
      const active = document.activeElement
      const dlg = document.querySelector('[role="dialog"]')
      return dlg ? dlg.contains(active) || active === dlg : false
    })
    expect(isInsideDialog).toBe(true)
  }
})

test('Escape key closes alert modal and returns focus', async ({ page }) => {
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

// ─── Accessibility: ARIA roles and landmarks ──────────────────────────────────

test('page has main navigation landmark', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({ timeout: 10_000 })
})

test('page has main content landmark', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
})

test('connection badge has role=status', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 10_000 })
})

test('price feeds grid has aria-label', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const grid = page.locator('[aria-label="Price feeds"]')
  const loading = page.locator('[aria-label="Loading price cards"]')
  await expect(grid.or(loading).first()).toBeVisible({ timeout: 10_000 })
})

test('API docs page is accessible via nav link', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await page.getByRole('link', { name: 'API Docs' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/api-docs/, { timeout: 5_000 })
  await expect(page.getByRole('main')).toBeVisible()
})

// ─── Accessibility: view toggle aria-pressed ─────────────────────────────────

test('card view button reflects aria-pressed state', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

  const cardBtn = page.getByRole('button', { name: 'Card view' })
  const tableBtn = page.getByRole('button', { name: 'Table view' })

  await expect(cardBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(tableBtn).toHaveAttribute('aria-pressed', 'false')

  await tableBtn.click()
  await expect(tableBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(cardBtn).toHaveAttribute('aria-pressed', 'false')
})
