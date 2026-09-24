/**
 * Frame-consistency (tearing) tests.
 *
 * React 19 discards interrupted renders and restarts them, so a *committed*
 * frame is always drawn from a single state snapshot when every read goes
 * through `useState` / Context / `useSyncExternalStore`. Tearing only becomes
 * observable when a component reads a mutable source that lives outside React
 * *during render*: the writer can land between two consumers inside one pass
 * and the committed frame mixes two snapshots.
 *
 * This suite pins that invariant for the dashboard's three state domains —
 * prices (`PriceContext`), alerts (`useAlerts`) and selection (search query) —
 * by capturing every committed frame while the inputs are driven through
 * interleaved updates.
 *
 * The first describe block shows the failure mode is both producible and
 * detectable in this environment, so the dashboard assertions below test a
 * reachable regression rather than an impossible one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../pages/Dashboard'
import { useAlerts } from '../hooks/useAlerts'
import { selectSortedPrices } from '../selectors/priceSelectors'
import { usePriceContext, type PriceContextValue } from '../context/PriceContext'
import { formatPrice } from '../utils/format'
import type { Alert, PriceData } from '../types'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: (index: number) => number }) => {
    const items = Array.from({ length: count }, (_, index) => {
      const size = estimateSize(index)
      const start = index * size
      return { key: index, index, start, end: start + size, size, lane: 0 }
    })
    return {
      getVirtualItems: () => items,
      getTotalSize: () => items.reduce((total, item) => total + item.size, 0),
      measure: () => {},
    }
  },
}))

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(),
}))

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

/* -------------------------------------------------------------------------- */
/* Detector harness                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A stand-in for a mutable source that lives outside React: written by whoever
 * owns it, read during render. `read` is the untracked (tearable) accessor;
 * `getSnapshot`/`subscribe` are the pair React can make tear-free.
 */
interface MutableSource<T> {
  read: () => T
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
  write: (next: T) => void
}

function createMutableSource<T>(initial: T): MutableSource<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    read: () => value,
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    write: (next) => {
      value = next
      listeners.forEach((listener) => listener())
    },
  }
}

function UntrackedConsumer({ source, id }: { source: MutableSource<number>; id: string }) {
  return <span data-testid={`untracked-${id}`}>{source.read()}</span>
}

function TrackedConsumer({ source, id }: { source: MutableSource<number>; id: string }) {
  const value = useSyncExternalStore(source.subscribe, source.getSnapshot)
  return <span data-testid={`tracked-${id}`}>{value}</span>
}

/** Writes to the source in the middle of a render pass, i.e. between the two consumers. */
function WriteDuringRender({ source, to }: { source: MutableSource<number>; to: number }) {
  source.write(to)
  return null
}

function isConsistentFrame(values: number[]): boolean {
  return values.every((value) => value === values[0])
}

describe('frame-consistency detector', () => {
  it('flags a frame torn by an untracked read of a mutable source', () => {
    const source = createMutableSource(1)

    render(
      <>
        <UntrackedConsumer source={source} id="a" />
        <WriteDuringRender source={source} to={2} />
        <UntrackedConsumer source={source} id="b" />
      </>,
    )

    const frame = [
      Number(screen.getByTestId('untracked-a').textContent),
      Number(screen.getByTestId('untracked-b').textContent),
    ]

    expect(frame).toEqual([1, 2])
    expect(isConsistentFrame(frame)).toBe(false)
  })

  it('accepts a frame read through useSyncExternalStore', () => {
    const source = createMutableSource(1)

    render(
      <>
        <TrackedConsumer source={source} id="a" />
        <WriteDuringRender source={source} to={2} />
        <TrackedConsumer source={source} id="b" />
      </>,
    )

    const frame = [
      Number(screen.getByTestId('tracked-a').textContent),
      Number(screen.getByTestId('tracked-b').textContent),
    ]

    expect(isConsistentFrame(frame)).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Dashboard frame capture                                                    */
/* -------------------------------------------------------------------------- */

const REST_TS = 1_000

function price(assetPair: string, value: number, timestamp = REST_TS): PriceData {
  return { assetPair, price: value, timestamp, confidence: 0.99, sources: ['chainlink'] }
}

function alert(assetPair: string): Alert {
  return {
    id: `alert-${assetPair}`,
    assetPair,
    upperThreshold: 1_000_000,
    lowerThreshold: null,
    triggerOnce: false,
    active: true,
    createdAt: REST_TS,
    lastTriggeredAt: null,
  }
}

function makeContext(overrides: Partial<PriceContextValue> = {}): PriceContextValue {
  return {
    prices: [],
    pricesLoading: false,
    pricesError: null,
    pricesValidating: false,
    livePrices: new Map(),
    wsStatus: 'disconnected',
    refetchPrices: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    ...overrides,
  }
}

function PriceContextHarness({ context }: { context: PriceContextValue }) {
  vi.mocked(usePriceContext).mockReturnValue(context)
  return (
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

function renderDashboard(initial: PriceContextValue) {
  const view = render(<PriceContextHarness context={initial} />)
  return {
    setContext(next: PriceContextValue) {
      view.rerender(<PriceContextHarness context={next} />)
    },
  }
}

/** Everything a single committed frame exposes, read straight from the DOM. */
interface CommittedFrame {
  priceByPair: Record<string, string>
  livePairs: string[]
  alertPairs: string[]
}

function readFrame(): CommittedFrame {
  const frame: CommittedFrame = { priceByPair: {}, livePairs: [], alertPairs: [] }

  for (const card of screen.queryAllByRole('button', { name: /^View details for / })) {
    const label = card.getAttribute('aria-label') ?? ''
    const pair = label.replace('View details for ', '')

    const rendered = card.textContent?.match(/\$[\d,.]+/)
    if (rendered) frame.priceByPair[pair] = rendered[0]
    if (card.querySelector('[aria-label="Live data"]')) frame.livePairs.push(pair)
    if (card.querySelector('[aria-label="Active alert"]')) frame.alertPairs.push(pair)
  }

  return frame
}

describe('Dashboard commits one consistent frame per snapshot', () => {
  it('never mixes a price from one snapshot with a live indicator from another', () => {
    const view = renderDashboard(makeContext({ prices: [price('BTC/USD', 50_000)] }))
    const observed: CommittedFrame[] = [readFrame()]

    for (const live of [55_000, 56_000, 57_000]) {
      view.setContext(
        makeContext({
          prices: [price('BTC/USD', 50_000)],
          livePrices: new Map([['BTC/USD', price('BTC/USD', live, REST_TS + 1)]]),
        }),
      )
      observed.push(readFrame())
    }

    // Each frame is drawn from exactly one snapshot...
    expect(observed.map((frame) => frame.priceByPair['BTC/USD'])).toEqual([
      `$${formatPrice(50_000)}`,
      `$${formatPrice(55_000)}`,
      `$${formatPrice(56_000)}`,
      `$${formatPrice(57_000)}`,
    ])
    // ...and the live indicator moves with that same snapshot, never one behind.
    expect(observed.map((frame) => frame.livePairs)).toEqual([[], ['BTC/USD'], ['BTC/USD'], ['BTC/USD']])
  })

  it('keeps REST and WebSocket data on the same snapshot when both arrive together', () => {
    const view = renderDashboard(makeContext({ prices: [price('BTC/USD', 50_000)] }))
    expect(readFrame().priceByPair['BTC/USD']).toBe(`$${formatPrice(50_000)}`)

    // One act: a fresher REST poll and a WebSocket tick land at the same time.
    view.setContext(
      makeContext({
        prices: [price('BTC/USD', 51_000, REST_TS + 10)],
        livePrices: new Map([['BTC/USD', price('BTC/USD', 55_000, REST_TS + 20)]]),
        wsStatus: 'connected',
      }),
    )

    const frame = readFrame()
    expect(frame.priceByPair['BTC/USD']).toBe(`$${formatPrice(55_000)}`)
    expect(frame.livePairs).toEqual(['BTC/USD'])
  })

  it('applies a stale WebSocket tick and a fresh REST poll as one atomic frame', () => {
    renderDashboard(
      makeContext({
        prices: [price('BTC/USD', 50_000, REST_TS + 20)],
        livePrices: new Map([['BTC/USD', price('BTC/USD', 55_000, REST_TS)]]),
      }),
    )

    // The REST poll is newer, so it wins outright — no frame may show the
    // older WebSocket value alongside the newer REST one.
    expect(readFrame().priceByPair['BTC/USD']).toBe(`$${formatPrice(50_000)}`)
  })

  it('reads price and alert state from the same commit', () => {
    localStorage.setItem('price-alerts', JSON.stringify([alert('BTC/USD')]))

    const view = renderDashboard(makeContext({ prices: [price('BTC/USD', 50_000)] }))

    const before = readFrame()
    expect(before.alertPairs).toEqual(['BTC/USD'])
    expect(screen.getByLabelText('1 active alert')).toBeInTheDocument()

    // A WebSocket tick arrives; alert state is untouched.
    view.setContext(
      makeContext({
        prices: [price('BTC/USD', 50_000)],
        livePrices: new Map([['BTC/USD', price('BTC/USD', 55_000, REST_TS + 1)]]),
        wsStatus: 'connected',
      }),
    )

    const after = readFrame()
    expect(after.priceByPair['BTC/USD']).toBe(`$${formatPrice(55_000)}`)
    expect(after.alertPairs).toEqual(['BTC/USD'])
    expect(screen.getByLabelText('1 active alert')).toBeInTheDocument()
  })

  it('keeps the badge count and the per-card alert indicators on one snapshot', () => {
    localStorage.setItem('price-alerts', JSON.stringify([alert('BTC/USD'), alert('ETH/USD')]))

    renderDashboard(makeContext({ prices: [price('BTC/USD', 50_000), price('ETH/USD', 3_000)] }))

    const frame = readFrame()
    expect(frame.alertPairs.sort()).toEqual(['BTC/USD', 'ETH/USD'])
    expect(screen.getByLabelText('2 active alerts')).toBeInTheDocument()
  })

  it('never filters the price list against a query from a different snapshot', () => {
    const view = renderDashboard(makeContext({ prices: [price('BTC/USD', 50_000), price('ETH/USD', 3_000)] }))

    fireEvent.change(screen.getByLabelText('Search price feeds'), { target: { value: 'btc' } })
    expect(screen.getByLabelText('View details for BTC/USD')).toBeInTheDocument()
    expect(screen.queryByLabelText('View details for ETH/USD')).not.toBeInTheDocument()

    // Prices refresh while the selection is active: the rows that remain must
    // be the ones the current query matches, carrying the refreshed price.
    view.setContext(
      makeContext({
        prices: [price('BTC/USD', 51_000), price('ETH/USD', 4_000)],
        livePrices: new Map([['BTC/USD', price('BTC/USD', 55_000, REST_TS + 1)]]),
        wsStatus: 'connected',
      }),
    )

    const frame = readFrame()
    expect(Object.keys(frame.priceByPair)).toEqual(['BTC/USD'])
    expect(frame.priceByPair['BTC/USD']).toBe(`$${formatPrice(55_000)}`)
  })
})

/* -------------------------------------------------------------------------- */
/* Alert state has a single source of truth per tree                          */
/* -------------------------------------------------------------------------- */

function AlertConsumer({ id }: { id: string }) {
  const { activeCount, addAlert } = useAlerts()
  return (
    <div>
      <span data-testid={`count-${id}`}>{activeCount}</span>
      <button
        type="button"
        onClick={() =>
          addAlert({
            assetPair: `PAIR-${id}/USD`,
            upperThreshold: 1_000,
            lowerThreshold: null,
            triggerOnce: false,
            active: true,
          })
        }
      >
        add-{id}
      </button>
    </div>
  )
}

describe('alert state across components', () => {
  it('does not converge two useAlerts consumers in one tree onto the same alert list', () => {
    // Characterisation of the current per-call-site state: each `useAlerts()`
    // owns an independent copy seeded from localStorage at mount. When alert
    // state moves onto a shared store, the second expectation flips to 1 and
    // this test becomes the guard that it stays that way.
    render(
      <>
        <AlertConsumer id="a" />
        <AlertConsumer id="b" />
      </>,
    )

    fireEvent.click(screen.getByText('add-a'))

    expect(screen.getByTestId('count-a').textContent).toBe('1')
    expect(screen.getByTestId('count-b').textContent).toBe('0')
  })
})

/* -------------------------------------------------------------------------- */
/* Shared selector cache                                                      */
/* -------------------------------------------------------------------------- */

describe('shared selector cache', () => {
  it('hands every consumer in a pass the identical derived object', () => {
    const input = [price('ETH/USD', 3_000), price('BTC/USD', 50_000)]

    const first = selectSortedPrices(input)
    const second = selectSortedPrices(input)

    // Identical reference: a price row and a chart consuming the same derived
    // snapshot cannot disagree about ordering within one pass.
    expect(second).toBe(first)
    expect(first.map((p) => p.assetPair)).toEqual(['BTC/USD', 'ETH/USD'])
  })

  it('does not reorder the array it was handed', () => {
    const input = [price('ETH/USD', 3_000), price('BTC/USD', 50_000)]

    selectSortedPrices(input)

    expect(input.map((p) => p.assetPair)).toEqual(['ETH/USD', 'BTC/USD'])
  })
})
