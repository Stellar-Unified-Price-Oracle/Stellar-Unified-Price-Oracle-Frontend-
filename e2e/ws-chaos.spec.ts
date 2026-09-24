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

// Block service workers so MSW can't intercept /api/* before the page.route
// mocks in this file (the SW handles requests ahead of Playwright routing).
test.use({ serviceWorkers: 'block' })

// The real backend aggregates prices itself, so a WS price_update is always
// confirmed by the next REST call — a WS value only persists in the UI when
// REST returns the same value. The mocked REST therefore needs to track the
// latest WS-pushed state per pair, or every optimistic update is rolled back
// to the stale seed price a moment after it renders (flaky assertions).
interface MutablePriceFeed {
  /** Current REST-visible price per asset pair (falls back to the seed price). */
  current: (pair: string) => { assetPair: string; price: number; timestamp: number }
  /** Record a WS-pushed price so REST confirms it instead of the seed. */
  applyUpdate: (assetPair: string, price: number, timestamp: number) => void
}

function createPriceFeed(): MutablePriceFeed {
  const byPair = new Map(
    BASE_PRICES.map((p) => [p.assetPair, { assetPair: p.assetPair, price: p.price, timestamp: p.timestamp }]),
  )
  return {
    current: (pair) => byPair.get(pair) ?? { assetPair: pair, price: 0, timestamp: Date.now() },
    applyUpdate: (assetPair, price, timestamp) => {
      byPair.set(assetPair, { assetPair, price, timestamp })
    },
  }
}

async function mockPricesApi(page: import('@playwright/test').Page, feed: MutablePriceFeed) {
  await page.route('**/api/prices**', (route) => {
    const list = BASE_PRICES.map((p) => {
      const current = feed.current(p.assetPair)
      return { ...p, price: current.price, timestamp: current.timestamp }
    })
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(list) })
  })
}

test.describe('WebSocket chaos', () => {
  test('malformed and truncated frames do not break the live feed — the next good update still lands', async ({
    page,
  }) => {
    const feed = createPriceFeed()
    await mockPricesApi(page, feed)

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))

          // A burst of garbage a flaky connection might deliver, none of it
          // should ever reach the UI or break the socket. Sent after the
          // handshake so every browser has the socket open (frames sent
          // before the client connects can be dropped, e.g. Firefox).
          ws.send('{"type":"price_upd') // truncated mid-frame
          ws.send('not json at all')
          ws.send(JSON.stringify({ type: 'price_update', assetPair: 'BTC/USD', price: 'not-a-number' }))

          // Then a real update — this is the one that should actually render.
          const good = priceUpdate({ price: 61_234, seq: 1 })
          feed.applyUpdate(good.assetPair, good.price, good.timestamp)
          ws.send(JSON.stringify(good))
        }
      })
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    // The live price replaces the REST-seeded 50,000 with the WS value —
    // proves the malformed frames ahead of it didn't wedge the pipeline.
    await expect(page.getByText(/61,234|61234/).first()).toBeVisible({ timeout: 10_000 })
  })

  test('out-of-order and duplicate frames resolve to the latest value, not a stale one', async ({ page }) => {
    const feed = createPriceFeed()
    await mockPricesApi(page, feed)

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))

          // The server's current value only ever reflects the frames it sends;
          // the stale re-delivery below is not a server state change.
          const latest = priceUpdate({ price: 70_000, seq: 5 })
          feed.applyUpdate(latest.assetPair, latest.price, latest.timestamp)
          ws.send(JSON.stringify(latest))
          // A stale, out-of-order re-delivery of an earlier value — must be
          // discarded, not overwrite the newer price already shown.
          ws.send(JSON.stringify(priceUpdate({ price: 12_345, seq: 2 })))
          // An exact duplicate of the first frame.
          ws.send(JSON.stringify(priceUpdate({ price: 70_000, seq: 5 })))
        }
      })
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/70,000|70000/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/12,345|12345/)).toHaveCount(0)
  })

  test('a throttled (slow) connection still delivers the update once it arrives', async ({ page }) => {
    const feed = createPriceFeed()
    await mockPricesApi(page, feed)

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))

          // Simulate a throttled link: the update is delayed well past a
          // normal round-trip before it's sent at all.
          setTimeout(() => {
            const update = priceUpdate({ price: 55_555, seq: 1 })
            feed.applyUpdate(update.assetPair, update.price, update.timestamp)
            ws.send(JSON.stringify(update))
          }, 3_000)
        }
      })
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })

    // Not there yet — the throttled frame hasn't arrived.
    await expect(page.getByText(/55,555|55555/)).toHaveCount(0)

    // Once it does arrive, the UI picks it up without needing a reload.
    await expect(page.getByText(/55,555|55555/).first()).toBeVisible({ timeout: 8_000 })
  })

  test('recovers after a disconnect: reconnects and the UI reflects fresh data again', async ({ page }) => {
    const feed = createPriceFeed()
    await mockPricesApi(page, feed)

    let connectionAttempt = 0

    await page.routeWebSocket(WS_PATTERN, (ws: WebSocketRoute) => {
      connectionAttempt += 1
      const isFirstConnection = connectionAttempt === 1

      ws.onMessage((message) => {
        const parsed = JSON.parse(String(message)) as { type: string; protocolVersion?: number }
        if (parsed.type === 'hello') {
          ws.send(JSON.stringify({ type: 'welcome', protocolVersion: parsed.protocolVersion ?? 1 }))

          if (isFirstConnection) {
            const first = priceUpdate({ price: 40_000, seq: 1 })
            feed.applyUpdate(first.assetPair, first.price, first.timestamp)
            ws.send(JSON.stringify(first))
            // Simulate the connection dropping shortly after.
            setTimeout(() => ws.close({ code: 1006, reason: 'simulated network drop' }), 500)
          } else {
            // The client's automatic reconnect lands here — recovery. The
            // server keeps one monotonic seq counter per client session, so
            // it resumes at seq 2, not 1 (the client drops anything ≤ the
            // last seen seq).
            const fresh = priceUpdate({ price: 90_909, seq: 2 })
            feed.applyUpdate(fresh.assetPair, fresh.price, fresh.timestamp)
            ws.send(JSON.stringify(fresh))
          }
        }
      })
    })

    await page.goto('/dashboard')
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

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // The dashboard still renders correctly from the REST snapshot alone —
    // a missing WS frame is not a fatal state.
    await expect(page.locator('[aria-label="Price feeds"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/50,000|50000/).first()).toBeVisible({ timeout: 10_000 })
  })
})
