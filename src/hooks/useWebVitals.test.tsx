import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useWebVitals } from './useWebVitals'

let mockAnalyticsEndpoint = ''

vi.mock('../config', () => ({
  config: {
    apiUrl: '',
    wsUrl: '',
    refreshInterval: 10_000,
    wsReconnectDelay: 3_000,
    wsBroadcastInterval: 5_000,
    get analyticsEndpoint() {
      return mockAnalyticsEndpoint
    },
  },
}))

const mocks = {
  onLCP: vi.fn(),
  onFID: vi.fn(),
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onTTFB: vi.fn(),
  sendBeacon: vi.fn().mockReturnValue(true),
  ric: vi.fn().mockImplementation((cb: () => void) => cb()),
}

vi.mock('web-vitals', () => ({
  onLCP: (...args: unknown[]) => mocks.onLCP(...args),
  onFID: (...args: unknown[]) => mocks.onFID(...args),
  onCLS: (...args: unknown[]) => mocks.onCLS(...args),
  onINP: (...args: unknown[]) => mocks.onINP(...args),
  onFCP: (...args: unknown[]) => mocks.onFCP(...args),
  onTTFB: (...args: unknown[]) => mocks.onTTFB(...args),
}))

function TestComponent() {
  useWebVitals()
  return null
}

function createMetric(overrides: Partial<{ name: string; value: number; rating: string; delta: number; id: string }> = {}) {
  return {
    name: 'LCP',
    value: 1500,
    rating: 'good',
    delta: 0,
    id: 'v1',
    entries: [],
    navigationType: 'navigate' as const,
    ...overrides,
  }
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAnalyticsEndpoint = ''
  vi.stubGlobal('navigator', {
    doNotTrack: undefined,
    sendBeacon: mocks.sendBeacon,
    connection: { effectiveType: '4g' },
  })
  vi.stubGlobal('requestIdleCallback', mocks.ric)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useWebVitals', () => {
  it('registers all web-vital observers on mount', () => {
    render(<TestComponent />)
    expect(mocks.onLCP).toHaveBeenCalledTimes(1)
    expect(mocks.onFID).toHaveBeenCalledTimes(1)
    expect(mocks.onCLS).toHaveBeenCalledTimes(1)
    expect(mocks.onINP).toHaveBeenCalledTimes(1)
    expect(mocks.onFCP).toHaveBeenCalledTimes(1)
    expect(mocks.onTTFB).toHaveBeenCalledTimes(1)
  })

  it('sends report via sendBeacon when analytics endpoint is configured', async () => {
    mockAnalyticsEndpoint = 'https://analytics.example.com/vitals'

    render(<TestComponent />)

    const callback = mocks.onLCP.mock.calls[0][0]
    callback(createMetric({ name: 'LCP', value: 2500, rating: 'needs-improvement' }))

    expect(mocks.sendBeacon).toHaveBeenCalledTimes(1)
    const [url, blob] = mocks.sendBeacon.mock.calls[0]
    expect(url).toBe('https://analytics.example.com/vitals')
    const body = JSON.parse(await readBlobText(blob as Blob))
    expect(body.name).toBe('LCP')
    expect(body.value).toBe(2500)
    expect(body.rating).toBe('needs-improvement')
    expect(body.route).toBe('/')
    expect(body.viewport).toBe('1024x768')
    expect(body.connection).toBe('4g')
  })

  it('does not call sendBeacon when analytics endpoint is empty', () => {
    render(<TestComponent />)

    const callback = mocks.onLCP.mock.calls[0][0]
    callback(createMetric())

    expect(mocks.sendBeacon).not.toHaveBeenCalled()
  })

  it('respects Do Not Track', () => {
    vi.stubGlobal('navigator', {
      doNotTrack: '1',
      sendBeacon: mocks.sendBeacon,
    })

    render(<TestComponent />)

    expect(mocks.onLCP).not.toHaveBeenCalled()
    expect(mocks.sendBeacon).not.toHaveBeenCalled()
  })

  it('respects Global Privacy Control', () => {
    vi.stubGlobal('navigator', {
      doNotTrack: undefined,
      globalPrivacyControl: true,
      sendBeacon: mocks.sendBeacon,
    })

    render(<TestComponent />)

    expect(mocks.onLCP).not.toHaveBeenCalled()
    expect(mocks.sendBeacon).not.toHaveBeenCalled()
  })

  it('handles missing connection API gracefully', () => {
    vi.stubGlobal('navigator', {
      doNotTrack: undefined,
      sendBeacon: mocks.sendBeacon,
      connection: undefined,
    })

    render(<TestComponent />)

    const callback = mocks.onLCP.mock.calls[0][0]
    expect(() => callback(createMetric())).not.toThrow()
  })

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

    render(<TestComponent />)

    const callback = mocks.onLCP.mock.calls[0][0]
    callback(createMetric())

    expect(setTimeoutSpy).toHaveBeenCalled()
    setTimeoutSpy.mockRestore()
  })
})
