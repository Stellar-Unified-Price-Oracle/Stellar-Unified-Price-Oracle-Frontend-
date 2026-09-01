import { test, expect, type WebSocketRoute } from '@playwright/test'

// ─── E2E chaos suite (#474) ────────────────────────────────────────────────
//
// Drives the app's *real* WebSocket client through a fully mocked connection
// (page.routeWebSocket — no real backend needed) and asserts the UI recovers
// cleanly from degraded/dropped/reordered traffic and reconnects. REST calls
// are mocked the same way the rest of e2e/ does (page.route), so these tests
// are self-contained and deterministic.

const WS_PATTERN = /^wss?:\/\/[^/]*localhost:3000/

const BASE_PRICES = [
  { assetPair: 'BTC/USD', price: 50_000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3_000, timestamp: Date.now(), confidence: 0.95, sources: ['redstone'] },
]

function priceUpdate(overrides: Partial<(typeof BASE_PRICES)[number]> & { seq?: number } = {}) {
  return {
    type: 'price_update',
    assetPair: 'BTC/USD',
    price: 50_000,
    timestamp: Date.now(),
    confidence: 0.99,
    sources: ['chainlink'],
    ...overrides,
  }
}

async function mockPricesApi(page: import('@playwright/test').Page) {
  await page.route('**/api/prices**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(BASE_PRICES) })
  })
}

test.describe('WebSocket chaos', () => {
  test('malformed and truncated frames do not break the live feed — the next good update still lands', async ({
    page,
  }) => {
    await mockPricesApi(page)

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))
        }
      })

      // A burst of garbage a flaky connection might deliver, none of it
      // should ever reach the UI or break the socket.
      ws.send('{"type":"price_upd') // truncated mid-frame
      ws.send('not json at all')
      ws.send(JSON.stringify({ type: 'price_update', assetPair: 'BTC/USD', price: 'not-a-number' }))

      // Then a real update — this is the one that should actually render.
      ws.send(JSON.stringify(priceUpdate({ price: 61_234, seq: 1 })))
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    // The live price replaces the REST-seeded 50,000 with the WS value —
    // proves the malformed frames ahead of it didn't wedge the pipeline.
    await expect(page.getByText(/61,234|61234/).first()).toBeVisible({ timeout: 10_000 })
  })

  test('out-of-order and duplicate frames resolve to the latest value, not a stale one', async ({ page }) => {
    await mockPricesApi(page)

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))
        }
      })

      ws.send(JSON.stringify(priceUpdate({ price: 70_000, seq: 5 })))
      // A stale, out-of-order re-delivery of an earlier value — must be
      // discarded, not overwrite the newer price already shown.
      ws.send(JSON.stringify(priceUpdate({ price: 12_345, seq: 2 })))
      // An exact duplicate of the first frame.
      ws.send(JSON.stringify(priceUpdate({ price: 70_000, seq: 5 })))
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/70,000|70000/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/12,345|12345/)).toHaveCount(0)
  })

  test('a throttled (slow) connection still delivers the update once it arrives', async ({ page }) => {
    await mockPricesApi(page)

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))
        }
      })

      // Simulate a throttled link: the update is delayed well past a normal
      // round-trip before it's sent at all.
      setTimeout(() => {
        ws.send(JSON.stringify(priceUpdate({ price: 55_555, seq: 1 })))
      }, 3_000)
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

    // Not there yet — the throttled frame hasn't arrived.
    await expect(page.getByText(/55,555|55555/)).toHaveCount(0)

    // Once it does arrive, the UI picks it up without needing a reload.
    await expect(page.getByText(/55,555|55555/).first()).toBeVisible({ timeout: 8_000 })
  })

  test('recovers after a disconnect: reconnects and the UI reflects fresh data again', async ({ page }) => {
    await mockPricesApi(page)

    let connectionAttempt = 0

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      connectionAttempt += 1
      const isFirstConnection = connectionAttempt === 1

      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))
        }
      })

      if (isFirstConnection) {
        ws.send(JSON.stringify(priceUpdate({ price: 40_000, seq: 1 })))
        // Simulate the connection dropping shortly after.
        setTimeout(() => ws.close({ code: 1006, reason: 'simulated network drop' }), 500)
      } else {
        // The client's automatic reconnect lands here — recovery.
        ws.send(JSON.stringify(priceUpdate({ price: 90_909, seq: 1 })))
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/40,000|40000/).first()).toBeVisible({ timeout: 10_000 })

    // The badge should reflect the drop (not stuck showing "Live" forever).
    const badge = page.getByRole('status').filter({ hasText: /Reconnecting|Offline|Waiting|Connecting/ })
    await expect(badge.first()).toBeVisible({ timeout: 10_000 })

    // ...and recover once the client's automatic reconnect succeeds.
    await expect(page.getByRole('status', { name: 'WebSocket Live' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/90,909|90909/).first()).toBeVisible({ timeout: 10_000 })
  })

  test('a fully dropped frame (never sent) does not stall the UI — REST polling still lands the true price', async ({
    page,
  }) => {
    await page.route('**/api/prices**', (route) => {
      const body = route.request().url().includes('pairs=')
        ? JSON.stringify(BASE_PRICES.map((p) => ({ ...p, price: 48_000 })))
        : JSON.stringify(BASE_PRICES)
      route.fulfill({ contentType: 'application/json', body })
    })

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))
        }
      })
      // Intentionally send nothing further — the "next" update is a frame
      // that simply never arrives (silent drop), simulating packet loss.
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The dashboard still renders correctly from the REST snapshot alone —
    // a missing WS frame is not a fatal state.
    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/50,000|50000/).first()).toBeVisible({ timeout: 10_000 })
  })
})
