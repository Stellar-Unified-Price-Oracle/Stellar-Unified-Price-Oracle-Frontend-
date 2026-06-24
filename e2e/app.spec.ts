import { test, expect, type Page } from '@playwright/test'

const MOCK_PRICES = [
  { assetPair: 'BTC/USD', price: 50000.1234, timestamp: Date.now() - 10_000, confidence: 0.9876, sources: ['chainlink', 'redstone'] },
  { assetPair: 'ETH/USD', price: 3000.4567, timestamp: Date.now() - 20_000, confidence: 0.9532, sources: ['band', 'reflector'] },
  { assetPair: 'SOL/USD', price: 142.89, timestamp: Date.now() - 15_000, confidence: 0.9123, sources: ['chainlink'] },
  { assetPair: 'XRP/USD', price: 0.5123, timestamp: Date.now() - 30_000, confidence: 0.8845, sources: ['redstone', 'band'] },
]

const MOCK_HISTORY = {
  pair: 'BTC/USD',
  history: Array.from({ length: 20 }, (_, i) => ({
    price: 50000 + i * 100,
    timestamp: Date.now() - (20 - i) * 60_000,
    confidence: 0.95 + Math.random() * 0.05,
    sources: ['chainlink', 'redstone'],
  })),
}

async function setupMockApi(page: Page) {
  await page.route('**/api/prices', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRICES),
      })
    } else {
      await route.continue()
    }
  })

  await page.route('**/api/prices/**/history', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HISTORY),
    })
  })

  await page.route('**/api/prices/*', async (route) => {
    const url = route.request().url()
    const match = url.match(/\/api\/prices\/(.+)$/)
    if (match) {
      const pair = decodeURIComponent(match[1])
      const price = MOCK_PRICES.find((p) => p.assetPair === pair)
      if (price) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(price),
        })
        return
      }
    }
    await route.fulfill({ status: 404, body: 'Not found' })
  })

  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy', uptime: 123456 }),
    })
  })
}

test.describe('Dashboard', () => {
  test('loads and displays price cards', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
    await expect(page.getByText('Aggregated from Chainlink, Redstone, Band & Reflector')).toBeVisible()

    const cards = page.getByRole('button', { name: /View details for/ })
    await expect(cards).toHaveCount(4)

    for (const price of MOCK_PRICES) {
      await expect(page.getByText(price.assetPair)).toBeVisible()
    }
  })

  test('shows price details on each card', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    const btcCard = page.getByRole('button', { name: 'View details for BTC/USD' })
    await expect(btcCard).toBeVisible()
    await expect(btcCard.getByText('chainlink')).toBeVisible()
    await expect(btcCard.getByText('redstone')).toBeVisible()
    await expect(btcCard.getByText(/98\.8% confidence/)).toBeVisible()
  })

  test('navigates to price detail page on card click', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()

    await expect(page).toHaveURL(/\/price\/BTC%2FUSD/)
    await expect(page.getByRole('heading', { name: 'BTC/USD' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible()
    await expect(page.getByText('98.8% confidence')).toBeVisible()
  })

  test('shows WebSocket connection indicator', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    const badge = page.getByRole('status', { name: /WebSocket/ })
    await expect(badge).toBeVisible()

    const labels = ['WebSocket Offline', 'WebSocket Live', 'WebSocket Connecting', 'WebSocket Reconnecting']
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
    await setupMockApi(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search by asset pair...')
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
    await setupMockApi(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search by asset pair...')
    await searchInput.fill('zzz')

    await expect(page.getByText(/No results for/)).toBeVisible()
    await expect(page.getByRole('button', { name: /View details for/ })).toHaveCount(0)
  })

  test('clears search and restores all cards', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search by asset pair...')
    await searchInput.fill('eth')
    await expect(page.getByRole('button', { name: /View details for/ })).toHaveCount(1)

    await searchInput.fill('')
    await expect(page.getByRole('button', { name: /View details for/ })).toHaveCount(4)
  })

  test('shows connection badge text', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    const badge = page.getByRole('status', { name: /WebSocket/ })
    await expect(badge).toBeVisible()

    const text = await badge.textContent()
    expect(['Offline', 'Live', 'Connecting', 'Reconnecting']).toContain(text?.trim())
  })
})

test.describe('Error states', () => {
  test('shows error message when API fails', async ({ page }) => {
    await page.route('**/api/prices', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })
    await page.goto('/')

    const alert = page.getByRole('alert').first()
    await expect(alert).toBeVisible({ timeout: 15_000 })
  })

  test('shows error message for network failure', async ({ page }) => {
    await page.route('**/api/prices', async (route) => {
      await route.abort('connectionrefused')
    })
    await page.goto('/')

    const alert = page.getByRole('alert').first()
    await expect(alert).toBeVisible({ timeout: 15_000 })
  })

  test('shows empty state when API returns empty', async ({ page }) => {
    await page.route('**/api/prices', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    })
    await page.goto('/')

    await expect(page.getByText('No price feeds available')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Navigation', () => {
  test('navigates from dashboard to detail and back', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()
    await expect(page).toHaveURL(/\/price\/BTC%2FUSD/)
    await expect(page.getByRole('heading', { name: 'BTC/USD' })).toBeVisible()

    await page.getByRole('button', { name: 'Back to Dashboard' }).click()
    await expect(page).toHaveURL(/\/Stellar-Unified-Price-Oracle-Frontend-\/?$/)
    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
  })

  test('direct navigation to root shows dashboard', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Price Oracle Dashboard' })).toBeVisible()
  })
})

test.describe('Price detail page', () => {
  test('shows price detail with confidence and back button', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()

    await expect(page.getByRole('heading', { name: 'BTC/USD' })).toBeVisible()
    await expect(page.getByText(/98\.8% confidence/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible()
  })

  test('opens alert modal from detail page', async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'View details for BTC/USD' }).click()
    await page.getByRole('button', { name: 'Set price alert' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('New Price Alert')).toBeVisible()
  })
})
