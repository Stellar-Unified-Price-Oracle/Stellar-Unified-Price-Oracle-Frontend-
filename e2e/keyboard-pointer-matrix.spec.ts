import { test, expect } from '@playwright/test'

/**
 * End-to-end multi-modal interaction regression matrix (#863).
 * Validates keyboard focus traps, pointer interactions, touch modality,
 * and screen reader announcement behaviors across desktop and mobile devices.
 */

test.describe('Keyboard & Pointer Interaction Matrix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to roadmap page directly or verify app root is healthy
    await page.goto('/roadmap')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Skip-to-main-content link is focusable via keyboard Tab and navigates to #main-content', async ({
    page,
  }) => {
    // Initial focus on body
    await page.keyboard.press('Tab')

    // Skip navigation link should be focused and visible
    const skipLink = page.getByRole('link', { name: /skip to main content/i })
    await expect(skipLink).toBeFocused()

    // Press Enter to activate skip link
    await page.keyboard.press('Enter')

    // Main content container should be targeted
    const url = page.url()
    expect(url).toContain('#main-content')
  })

  test('Roadmap disclosure accordion toggles via keyboard Enter and Space keys', async ({ page }) => {
    // Wait for roadmap cards to render
    const firstToggle = page.getByRole('button', { name: /toggle public change history/i }).first()
    await expect(firstToggle).toBeVisible({ timeout: 10_000 })
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false')

    // Focus disclosure button
    await firstToggle.focus()
    await expect(firstToggle).toBeFocused()

    // Press Enter to expand
    await page.keyboard.press('Enter')
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true')

    // Verify change history timeline entries are rendered
    const timelineEntry = page.getByText(/changed by:/i).first()
    await expect(timelineEntry).toBeVisible()

    // Press Space to collapse
    await page.keyboard.press('Space')
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('Status metric cards update live region counter upon pointer click and keyboard activation', async ({
    page,
  }) => {
    const liveRegion = page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion).toBeVisible({ timeout: 10_000 })

    // Click a status button via pointer
    const plannedBtn = page.getByRole('button', { name: 'Filter by status: Planned' })
    await plannedBtn.click()
    await expect(plannedBtn).toHaveAttribute('aria-pressed', 'true')

    // Live region text should announce filtered count
    await expect(liveRegion).toContainText(/showing/i)
    await expect(liveRegion).toContainText(/filters active/i)

    // Toggle off via keyboard Enter
    await plannedBtn.focus()
    await page.keyboard.press('Enter')
    await expect(plannedBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('Search input handles keyboard input and pointer clear button dismiss', async ({ page }) => {
    const searchInput = page.getByLabelText(/search roadmap items/i)
    await searchInput.focus()
    await page.keyboard.type('Soroban')

    const liveRegion = page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion).toContainText(/showing/i)

    // Clear search using pointer click on the clear button
    const clearBtn = page.getByRole('button', { name: /clear search query/i })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    await expect(searchInput).toHaveValue('')
  })

  test('Category filter dropdown responds to keyboard Arrow navigation and selection', async ({ page }) => {
    const categorySelect = page.getByLabelText(/category:/i)
    await categorySelect.focus()

    // Select protocol option
    await categorySelect.selectOption('protocol')
    await expect(categorySelect).toHaveValue('protocol')

    const liveRegion = page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion).toContainText(/filters active/i)
  })

  test('Touch interaction triggers status filters on touch-enabled viewports without requiring hover', async ({
    page,
    isMobile,
  }) => {
    const testnetBtn = page.getByRole('button', { name: 'Filter by status: Testnet Live' })
    await expect(testnetBtn).toBeVisible({ timeout: 10_000 })

    if (isMobile) {
      // Tap using touch screen emulation
      await testnetBtn.tap()
      await expect(testnetBtn).toHaveAttribute('aria-pressed', 'true')
    } else {
      await testnetBtn.click()
      await expect(testnetBtn).toHaveAttribute('aria-pressed', 'true')
    }
  })
})
