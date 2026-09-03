import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useAnnounce,
  getAnnouncementRegistry as _getAnnouncementRegistry,
  resetAnnouncementRegistry,
} from '../useAnnounce'
import { usePriceAnnouncer } from '../usePriceAnnouncer'
import { useAlertAnnouncer } from '../useAlertAnnouncer'
import { useChartAnnouncer } from '../useChartAnnouncer'
import { useA11yConfig, setA11yConfig, DEFAULT_A11Y_CONFIG, A11Y_LOW_FREQUENCY } from '../useA11yConfig'
import type { PriceData, Alert } from '../../types'

describe('useAnnounce', () => {
  beforeEach(() => {
    resetAnnouncementRegistry()
  })

  it('announces messages to subscribers', () => {
    const { result } = renderHook(() => useAnnounce())
    const listener = vi.fn()

    result.current.subscribe(listener)
    const announced = result.current.announce('Test announcement')

    expect(announced).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test announcement',
        priority: 'polite',
      }),
    )
  })

  it('supports assertive priority announcements', () => {
    const { result } = renderHook(() => useAnnounce())
    const listener = vi.fn()

    result.current.subscribe(listener)
    result.current.announce('Urgent message', 'assertive')

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Urgent message',
        priority: 'assertive',
      }),
    )
  })

  it('deduplicates identical announcements', () => {
    const { result } = renderHook(() => useAnnounce({ deduplicationMs: 1000 }))
    const listener = vi.fn()

    result.current.subscribe(listener)

    // First announcement should work
    const first = result.current.announce('Duplicate test')
    expect(first).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    // Immediate second announcement should be deduplicated
    const second = result.current.announce('Duplicate test')
    expect(second).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('allows deduplication window to expire', async () => {
    const { result } = renderHook(() => useAnnounce({ deduplicationMs: 100 }))
    const listener = vi.fn()

    result.current.subscribe(listener)

    result.current.announce('Test')
    expect(listener).toHaveBeenCalledTimes(1)

    // Wait for dedup window to expire
    await vi.waitFor(() => {
      const announced = result.current.announce('Test')
      expect(announced).toBe(true)
    }, { timeout: 200 })

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('maintains announcement history', () => {
    const { result } = renderHook(() => useAnnounce())

    result.current.announce('First')
    result.current.announce('Second')
    result.current.announce('Third')

    const history = result.current.getHistory()
    expect(history.length).toBe(3)
    expect(history[0].message).toBe('First')
    expect(history[2].message).toBe('Third')
  })
})

describe('usePriceAnnouncer', () => {
  beforeEach(() => {
    resetAnnouncementRegistry()
  })

  it('announces significant price changes', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    const prices = [
      {
        assetPair: 'BTC/USD',
        price: 70000,
        confidence: 0.95,
        sources: [],
        timestamp: Date.now(),
      } as PriceData,
    ]

    const { rerender } = renderHook(
      ({ prices: p }) => usePriceAnnouncer(p, { minPercentageChange: 1 }),
      { initialProps: { prices: [prices[0]] } },
    )

    // Rerender with new price (1.5% change)
    rerender({
      prices: [{ ...prices[0], price: 71050 }],
    })

    await waitFor(() => {
      expect(listener).toHaveBeenCalled()
    })
  })

  it('respects minimum percentage change threshold', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    const prices = [
      {
        assetPair: 'BTC/USD',
        price: 70000,
        confidence: 0.95,
        sources: [],
        timestamp: Date.now(),
      } as PriceData,
    ]

    const { rerender } = renderHook(
      ({ prices: p }) => usePriceAnnouncer(p, { minPercentageChange: 2 }),
      { initialProps: { prices: [prices[0]] } },
    )

    // Rerender with only 0.5% change (below threshold)
    rerender({
      prices: [{ ...prices[0], price: 70350 }],
    })

    // Should not announce because change is below threshold
    await waitFor(
      () => {
        expect(listener).not.toHaveBeenCalled()
      },
      { timeout: 100 },
    )
  })
})

describe('useAlertAnnouncer', () => {
  beforeEach(() => {
    resetAnnouncementRegistry()
  })

  it('announces when alerts fire (fireCount increases)', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    const alerts = [
      {
        id: 'alert-1',
        assetPair: 'BTC/USD',
        upperThreshold: 75000,
        lowerThreshold: null,
        triggerOnce: false,
        fireCount: 0,
        percentageMode: false,
        percentageThreshold: null,
        percentageWindow: null,
        snoozedUntil: null,
        enabled: true,
      } as unknown as Alert,
    ]

    const { rerender } = renderHook(
      ({ alerts: a }) => useAlertAnnouncer(a),
      { initialProps: { alerts } },
    )

    // Rerender with alert that has fired (fireCount increased)
    rerender({
      alerts: [{ ...alerts[0], fireCount: 1 }],
    })

    await waitFor(() => {
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'assertive',
          message: expect.stringContaining('Alert'),
        }),
      )
    })
  })

  it('uses assertive priority for alert announcements', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    const alerts = [
      {
        id: 'alert-1',
        assetPair: 'BTC/USD',
        upperThreshold: null,
        lowerThreshold: 65000,
        triggerOnce: false,
        fireCount: 1,
        percentageMode: false,
        percentageThreshold: null,
        percentageWindow: null,
        snoozedUntil: null,
        enabled: true,
      } as unknown as Alert,
    ]

    renderHook(() => useAlertAnnouncer(alerts))

    await waitFor(() => {
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'assertive',
        }),
      )
    })
  })
})

describe('useChartAnnouncer', () => {
  beforeEach(() => {
    resetAnnouncementRegistry()
  })

  it('announces chart data on initial load', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    const range = {
      high: 75000,
      low: 70000,
      current: 72500,
    }

    renderHook(() => useChartAnnouncer(range))

    await waitFor(() => {
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Current price'),
        }),
      )
    })
  })

  it('respects minimum range change threshold', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    const range1 = {
      high: 75000,
      low: 70000,
      current: 72500,
    }

    const { rerender } = renderHook(
      ({ range }) => useChartAnnouncer(range, { minRangeChangePercent: 5 }),
      { initialProps: { range: range1 } },
    )

    // Reset listener call count after initial announcement
    listener.mockClear()

    // Rerender with only 0.5% range change
    const range2 = {
      high: 75038,
      low: 70000,
      current: 72500,
    }
    rerender({ range: range2 })

    // Should not announce small changes
    await waitFor(
      () => {
        expect(listener).not.toHaveBeenCalled()
      },
      { timeout: 100 },
    )
  })
})

describe('useA11yConfig', () => {
  beforeEach(() => {
    setA11yConfig(DEFAULT_A11Y_CONFIG)
  })

  it('provides default configuration', () => {
    const { result } = renderHook(() => useA11yConfig())

    expect(result.current.config).toEqual(DEFAULT_A11Y_CONFIG)
  })

  it('allows changing presets', () => {
    const { result } = renderHook(() => useA11yConfig())

    result.current.setPreset('low-frequency')
    expect(result.current.config.price.minChangePercent).toBe(5)
    expect(result.current.preset).toBe('low-frequency')
  })

  it('allows custom configuration', () => {
    const { result } = renderHook(() => useA11yConfig())

    result.current.setConfig({
      ...DEFAULT_A11Y_CONFIG,
      price: {
        ...DEFAULT_A11Y_CONFIG.price,
        minChangePercent: 2,
      },
    })

    expect(result.current.config.price.minChangePercent).toBe(2)
  })

  it('can disable announcements globally', () => {
    const { result } = renderHook(() => useA11yConfig())

    result.current.setConfig({ enabled: false })
    expect(result.current.config.enabled).toBe(false)
  })
})

describe('Announcement integration', () => {
  beforeEach(() => {
    resetAnnouncementRegistry()
    setA11yConfig(DEFAULT_A11Y_CONFIG)
  })

  it('integrates price, alert, and chart announcements', async () => {
    const { result: announceResult } = renderHook(() => useAnnounce())
    const listener = vi.fn()
    announceResult.current.subscribe(listener)

    // Simulate multiple types of announcements
    const { result: _priceResult } = renderHook(() =>
      usePriceAnnouncer([
        {
          assetPair: 'BTC/USD',
          price: 70000,
          confidence: 0.95,
          sources: [],
          timestamp: Date.now(),
        } as PriceData,
      ]),
    )

    const { result: _alertResult } = renderHook(() =>
      useAlertAnnouncer([
        {
          id: 'alert-1',
          assetPair: 'BTC/USD',
          upperThreshold: 75000,
          lowerThreshold: null,
          triggerOnce: false,
          fireCount: 1,
          percentageMode: false,
          percentageThreshold: null,
          percentageWindow: null,
          snoozedUntil: null,
          enabled: true,
        } as unknown as Alert,
      ]),
    )

    await waitFor(() => {
      expect(listener).toHaveBeenCalled()
    })
  })

  it('respects global accessibility configuration', () => {
    setA11yConfig(A11Y_LOW_FREQUENCY)
    const { result } = renderHook(() => useA11yConfig())

    expect(result.current.config.price.minChangePercent).toBe(5)
    expect(result.current.config.price.maxPerBatch).toBe(1)
  })
})
