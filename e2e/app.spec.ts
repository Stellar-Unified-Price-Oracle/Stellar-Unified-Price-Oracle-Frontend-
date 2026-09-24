import { test, expect } from '@playwright/test'

// The app under test is the VITE_USE_MOCK build, so MSW serves the API and
// these are the deterministic pairs/values it returns (see src/mocks/data.ts).
const MOCK_PAIRS = ['XLM/USD', 'BTC/USD', 'ETH/USD', 'USDC/USD']

test.describe('Dashboard', () => {
  test('loads and displays price cards', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
    await expect(page.getByText('Aggregated from Chainlink, Redstone, Band & Reflector')).toBeVisible()

    const cards = page.getByRole('button', { name: /View details for/ })
    await expect(cards).toHaveCount(4)

    for (const pair of MOCK_PAIRS) {
      await expect(page.getByText(pair)).toBeVisible()
    }
  })

  test('shows price details on each card', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const btcCard = page.getByRole('button', { name: 'View details for BTC/USD' })
    await expect(btcCard).toBeVisible()
    await expect(btcCard.getByText('chainlink')).toBeVisible()
    await expect(btcCard.getByText('redstone')).toBeVisible()
    await expect(btcCard.getByText(/98\.8% confidence/)).toBeVisible()
  })

  test('navigates to price detail page on card click', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()

    await expect(page).toHaveURL(/\/prices\/BTC%2FUSD/)
    await expect(page.getByRole('heading', { name: 'BTC/USD' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible()
    await expect(page.getByText('98.8% confidence')).toBeVisible()
  })

  test('shows WebSocket connection indicator', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const badge = page.getByRole('status', { name: /WebSocket/ })
    await expect(badge).toBeVisible()

    // In the mock build the WS endpoint is unreachable, so the badge may settle
    // on any status: connecting → waiting → reconnecting → offline/disconnected.
    const labels = [
      'WebSocket Offline',
      'WebSocket Live',
      'WebSocket Connecting',
      'WebSocket Reconnecting',
      'WebSocket Waiting',
      'WebSocket Disconnected',
      'WebSocket Paused',
    ]
    const hasValidLabel = async () => {
      for (const label of labels) {
        try {
          await expect(badge).toHaveAttribute('aria-label', label, { timeout: 100 })
          return true
        } catch {
          continue
        }
      }
      return false
    }
    expect(await hasValidLabel()).toBe(true)
  })

  test('filters price cards by search query', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder('Search pairs…')
    await expect(searchInput).toBeVisible()

    const cards = page.getByRole('button', { name: /View details for/ })
    await expect(cards).toHaveCount(4)

    await searchInput.fill('btc')
    await expect(cards).toHaveCount(1)
    await expect(page.getByText('BTC/USD')).toBeVisible()
    await expect(page.getByText('ETH/USD')).not.toBeVisible()

    await searchInput.fill('')
    await expect(cards).toHaveCount(4)
  })

  test('shows no results message when search matches nothing', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder('Search pairs…')
    await searchInput.fill('zzz')

    await expect(page.getByText(/No results for/)).toBeVisible()
    await expect(page.getByRole('button', { name: /View details for/ })).toHaveCount(0)
  })

  test('clears search and restores all cards', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder('Search pairs…')
    await searchInput.fill('eth')
    await expect(page.getByRole('button', { name: /View details for/ })).toHaveCount(1)

    await searchInput.fill('')
    await expect(page.getByRole('button', { name: /View details for/ })).toHaveCount(4)
  })

  test('shows connection badge text', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const badge = page.getByRole('status', { name: /WebSocket/ })
    await expect(badge).toBeVisible()

    const text = await badge.textContent()
    expect(['Offline', 'Live', 'Connecting', 'Reconnecting', 'Waiting', 'Disconnected', 'Paused']).toContain(
      text?.trim(),
    )
  })
})

test.describe('Error states', () => {
  // Block service workers so MSW can't intercept /api/* — otherwise the route
  // mocks below would never fire (the SW handles requests before Playwright).
  test.use({ serviceWorkers: 'block' })

  test('shows error message when API fails', async ({ page }) => {
    await page.route('**/api/prices', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const alert = page.getByRole('alert').first()
    // Retries (3 with exponential backoff) delay the error surfacing — give it
    // a generous window so slow CI runners don't flake (see error-states.spec).
    await expect(alert).toBeVisible({ timeout: 25_000 })
  })

  test('shows error message for network failure', async ({ page }) => {
    await page.route('**/api/prices', async (route) => {
      await route.abort('connectionrefused')
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const alert = page.getByRole('alert').first()
    // Same retry/backoff delay as above.
    await expect(alert).toBeVisible({ timeout: 25_000 })
  })

  test('shows empty state when API returns empty', async ({ page }) => {
    await page.route('**/api/prices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No price feeds available')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Navigation', () => {
  test('navigates from dashboard to detail and back', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()
    await expect(page).toHaveURL(/\/prices\/BTC%2FUSD/)
    await expect(page.getByRole('heading', { name: 'BTC/USD' })).toBeVisible()

    await page.getByRole('button', { name: 'Back to Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
  })

  test('direct navigation to the dashboard route shows dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
  })
})

test.describe('Price detail page', () => {
  test('shows price detail with confidence and back button', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()

    await expect(page.getByRole('heading', { name: 'BTC/USD' })).toBeVisible()
    await expect(page.getByText(/98\.8% confidence/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible()
  })

  test('opens alert modal from a price card', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

    const alertBtn = page
      .locator('[aria-label="Price feeds"] [aria-label*="alert" i], [aria-label="Price feeds"] [title*="alert" i]')
      .first()
    if (!(await alertBtn.isVisible())) return
    await alertBtn.click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('New Price Alert')).toBeVisible({ timeout: 5_000 })
  })
})
