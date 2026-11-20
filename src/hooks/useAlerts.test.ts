import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { usePriceContext } from '../context/PriceContext'
import type { Alert, LivePriceEntry, PriceData } from '../types'
import { computeAttribution } from '../utils/moveAttribution'
import { getLimiter } from '../utils/rateLimit'
import { useAlerts, AlertsProvider } from './useAlerts'

const AlertHarness = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>
    <AlertsProvider>{children}</AlertsProvider>
  </PreferencesProvider>
)

const { addToastMock } = vi.hoisted(() => ({ addToastMock: vi.fn() }))

const STORAGE_KEY = 'price-alerts'

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    livePrices: new Map(),
    prices: [],
  })),
}))

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock }),
}))

vi.mock('../api/schemas', () => ({
  AlertsArraySchema: {
    safeParse: (data: unknown) => ({
      success: true,
      data: Array.isArray(data)
        ? data.map((alert) => ({
            fireCount: 0,
            notifyOnRecovery: false,
            breachActive: false,
            percentageMode: false,
            percentageThreshold: null,
            percentageWindow: null,
            percentageDirection: null,
            percentageRelativeTo: null,
            percentageBaselinePrice: null,
            percentageBaselineTimestamp: null,
            snoozedUntil: null,
            cooldownMinutes: 5,
            conditionGroup: null,
            escalationPolicy: null,
            escalationState: null,
            channels: null,
            retestMode: false,
            retestState: null,
            ...alert,
          }))
        : data,
    }),
  },
  AlertHistoryArraySchema: { safeParse: (data: unknown) => ({ success: true, data }) },
}))

function livePricesMap(pair: string, price: number, timestamp = Date.now()): Map<string, LivePriceEntry> {
  const map = new Map<string, LivePriceEntry>()
  map.set(pair, {
    data: { assetPair: pair, price, timestamp, confidence: 1, sources: ['test'] },
  } as LivePriceEntry)
  return map
}

/** Builds a complete addAlert input with safe defaults for the fields tests don't exercise. */
function makeAlertInput(overrides: Record<string, unknown> = {}) {
  return {
    assetPair: 'BTC/USD',
    upperThreshold: null,
    lowerThreshold: null,
    triggerOnce: false,
    active: true,
    percentageMode: false,
    percentageThreshold: null,
    percentageWindow: null,
    percentageDirection: null,
    percentageRelativeTo: null,
    cooldownMinutes: 5,
    conditionGroup: null,
    escalationPolicy: null,
    retestMode: false,
    ...overrides,
  }
}

/** Seeds `localStorage` with a fully-formed legacy-era Alert (no conditionGroup/escalation fields). */
function seedLegacyAlert(overrides: Partial<Alert> = {}): void {
  const alert = {
    id: 'legacy-1',
    assetPair: 'BTC/USD',
    upperThreshold: 100,
    lowerThreshold: null,
    triggerOnce: false,
    fireCount: 0,
    percentageMode: false,
    percentageThreshold: null,
    percentageWindow: null,
    percentageDirection: null,
    percentageRelativeTo: null,
    percentageBaselinePrice: null,
    percentageBaselineTimestamp: null,
    snoozedUntil: null,
    cooldownMinutes: 60,
    active: true,
    createdAt: Date.now(),
    lastTriggeredAt: null,
    ...overrides,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([alert]))
}

beforeEach(() => {
  localStorage.clear()
  // The alert-create rate limiter is a module-level singleton (5/min); reset it
  // so earlier tests in this file don't exhaust the budget for later ones.
  getLimiter('alertCreate').reset()
  vi.mocked(usePriceContext).mockReturnValue({ livePrices: new Map(), prices: [] } as ReturnType<
    typeof usePriceContext
  >)
  addToastMock.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useAlerts', () => {
  it('fires at the retained crossing price after the displayed price falls back', () => {
    seedLegacyAlert()
    const pair = 'BTC/USD'
    const livePrices = livePricesMap(pair, 90)
    const data = livePrices.get(pair)!.data
    const records = [90, 110, 90].map(price =>
      computeAttribution({ ...data, type: 'price_update', price }, {}, null),
    )
    vi.mocked(usePriceContext).mockReturnValue({
      ...usePriceContext(),
      livePrices,
      attributionHistory: new Map([[pair, records]]),
    })
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    expect(result.current.alertHistory[0]?.price).toBe(110)
  })

  it('starts with empty alerts', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    expect(result.current.alerts).toHaveLength(0)
    expect(result.current.activeCount).toBe(0)
  })

  it('loads existing alerts from localStorage', () => {
    const existing = [
      {
        id: '1',
        assetPair: 'BTC/USD',
        upperThreshold: 60000,
        lowerThreshold: null,
        triggerOnce: false,
        active: true,
        createdAt: Date.now(),
        lastTriggeredAt: null,
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.activeCount).toBe(1)
  })

  it('disables an expired rule even when its price feed is unavailable', () => {
    seedLegacyAlert({ expiresAt: Date.now() - 1 })
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    expect(result.current.alerts[0].active).toBe(false)
    expect(result.current.alerts[0].expiresAt).toBeLessThan(Date.now())
  })

  it('adds an alert', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    act(() => {
      result.current.addAlert(
        makeAlertInput({ assetPair: 'ETH/USD', upperThreshold: 4000, lowerThreshold: 2000, triggerOnce: true }),
      )
    })
    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.alerts[0].assetPair).toBe('ETH/USD')
    expect(result.current.alerts[0].upperThreshold).toBe(4000)
    expect(result.current.alerts[0].lowerThreshold).toBe(2000)
    expect(result.current.alerts[0].triggerOnce).toBe(true)
    expect(result.current.alerts[0].id).toBeDefined()
    expect(result.current.alerts[0].createdAt).toBeDefined()
    expect(result.current.alerts[0].lastTriggeredAt).toBeNull()
  })

  it('persists to localStorage after add', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    act(() => {
      result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 60000 }))
    })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].assetPair).toBe('BTC/USD')
  })

  it('updates an alert', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    let id: string
    act(() => {
      const alert = result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 60000 }))
      id = alert!.id
    })
    act(() => {
      result.current.updateAlert(id, { upperThreshold: 65000, triggerOnce: true })
    })
    expect(result.current.alerts[0].upperThreshold).toBe(65000)
    expect(result.current.alerts[0].triggerOnce).toBe(true)
    expect(result.current.alerts[0].lowerThreshold).toBeNull()
  })

  it('removes an alert', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    let id: string
    act(() => {
      const alert = result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 60000 }))
      id = alert!.id
    })
    expect(result.current.alerts).toHaveLength(1)
    act(() => {
      result.current.removeAlert(id)
    })
    expect(result.current.alerts).toHaveLength(0)
  })

  it('filters alerts by pair', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    act(() => {
      result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 60000 }))
      result.current.addAlert(makeAlertInput({ assetPair: 'ETH/USD', upperThreshold: 4000 }))
    })
    const btcAlerts = result.current.getAlertsForPair('BTC/USD')
    expect(btcAlerts).toHaveLength(1)
    expect(btcAlerts[0].assetPair).toBe('BTC/USD')
    expect(result.current.getAlertsForPair('XRP/USD')).toHaveLength(0)
  })

  it('checks if pair has alerts', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    act(() => {
      result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 60000 }))
    })
    expect(result.current.hasAlertsForPair('BTC/USD')).toBe(true)
    expect(result.current.hasAlertsForPair('ETH/USD')).toBe(false)
  })

  it('excludes inactive alerts from count', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    act(() => {
      result.current.addAlert(makeAlertInput({ assetPair: 'BTC/USD', upperThreshold: 60000, active: false }))
      result.current.addAlert(makeAlertInput({ assetPair: 'ETH/USD', upperThreshold: 4000 }))
    })
    expect(result.current.activeCount).toBe(1)
  })

  it('records why an active rule check was skipped when no price is available', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })

    act(() => {
      result.current.addAlert(makeAlertInput({ upperThreshold: 100 }))
    })

    expect(result.current.evaluationTimeline[0]).toMatchObject({
      assetPair: 'BTC/USD',
      price: null,
      outcome: 'skipped',
      reason: 'price_unavailable',
    })
  })

  it('notifies on fresh client-observed source participation changes only', () => {
    const { rerender } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    const snapshot = (sources: string[], timestamp = Date.now()): PriceData => ({
      assetPair: 'BTC/USD',
      price: 100,
      timestamp,
      confidence: 0.99,
      sources,
    })

    act(() => {
      vi.mocked(usePriceContext).mockReturnValue({
        livePrices: new Map(),
        prices: [snapshot(['chainlink'])],
      } as ReturnType<typeof usePriceContext>)
      rerender()
    })
    expect(addToastMock).not.toHaveBeenCalled()

    act(() => {
      vi.mocked(usePriceContext).mockReturnValue({
        livePrices: new Map(),
        prices: [snapshot(['redstone'])],
      } as ReturnType<typeof usePriceContext>)
      rerender()
    })

    expect(addToastMock).toHaveBeenCalledTimes(2)
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warning',
        message: expect.stringContaining('chainlink is no longer present'),
      }),
    )
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('redstone is present in a current aggregate again'),
      }),
    )

    act(() => {
      vi.mocked(usePriceContext).mockReturnValue({
        livePrices: new Map(),
        prices: [snapshot([], Date.now() - 6 * 60_000)],
      } as ReturnType<typeof usePriceContext>)
      rerender()
    })
    expect(addToastMock).toHaveBeenCalledTimes(2)
  })

  it('notifies once when a one-time alert condition clears on the same routed channels', () => {
    vi.useFakeTimers()
    const firstTick = Date.now()
    localStorage.setItem(
      'notification-channels',
      JSON.stringify({
        email: { address: '', enabled: false },
        webPush: { enabled: false },
        webhook: { url: 'https://example.test/alerts', enabled: true },
        telegram: { chatId: '', enabled: false },
        discord: { channelId: '', enabled: false },
      }),
    )
    seedLegacyAlert({ triggerOnce: true, notifyOnRecovery: true, channels: ['webhook'] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
    const currentPriceContext = vi.mocked(usePriceContext)()
    vi.mocked(usePriceContext).mockReturnValue({
      ...currentPriceContext,
      livePrices: livePricesMap('BTC/USD', 150),
    })
    const { result, rerender } = renderHook(() => useAlerts(), { wrapper: AlertHarness })

    expect(result.current.alerts[0].active).toBe(false)
    expect(result.current.alerts[0].breachActive).toBe(true)

    act(() => {
      vi.setSystemTime(firstTick + 6 * 60_000)
      vi.mocked(usePriceContext).mockReturnValue({
        ...currentPriceContext,
        livePrices: livePricesMap('BTC/USD', 90, firstTick),
      })
      rerender()
    })

    expect(result.current.alerts[0].breachActive).toBe(true)
    expect(result.current.evaluationTimeline[0].reason).toBe('stale_price')
    expect(addToastMock).not.toHaveBeenCalled()

    act(() => {
      vi.setSystemTime(firstTick + 6 * 60_000 + 1_000)
      vi.mocked(usePriceContext).mockReturnValue({
        ...currentPriceContext,
        livePrices: livePricesMap('BTC/USD', 90),
      })
      rerender()
    })

    expect(result.current.alerts[0].breachActive).toBe(false)
    expect(result.current.evaluationTimeline[0].reason).toBe('threshold_cleared')
    expect(addToastMock).toHaveBeenCalledTimes(1)
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        message: expect.stringContaining('BTC/USD threshold cleared'),
      }),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const payloads = fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'alert_triggered' }),
        expect.objectContaining({
          type: 'alert_recovered',
          message: expect.stringContaining('BTC/USD threshold cleared'),
        }),
      ]),
    )
  })

  it('handles invalid localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json')
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
    expect(result.current.alerts).toHaveLength(0)
  })

  // ── #485 — transparent legacy migration on load ──────────────────────────
  describe('legacy alert migration (#485)', () => {
    it('attaches a conditionGroup to a legacy alert loaded from storage', () => {
      seedLegacyAlert()
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
      expect(result.current.alerts[0].conditionGroup).not.toBeNull()
      expect(result.current.alerts[0].conditionGroup?.conditions.length).toBeGreaterThan(0)
    })

    it('the migrated condition group evaluates equivalently to the old threshold logic', () => {
      seedLegacyAlert({ upperThreshold: 100, lowerThreshold: 50 })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<
        typeof usePriceContext
      >)
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
      expect(result.current.alerts[0].fireCount).toBe(1)
      expect(result.current.alerts[0].lastTriggeredAt).not.toBeNull()
    })

    it('does not lose or alter the original threshold fields while migrating', () => {
      seedLegacyAlert({ upperThreshold: 100, lowerThreshold: 50, cooldownMinutes: 7 })
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
      expect(result.current.alerts[0].upperThreshold).toBe(100)
      expect(result.current.alerts[0].lowerThreshold).toBe(50)
      expect(result.current.alerts[0].cooldownMinutes).toBe(7)
    })
  })

  // ── #487 — escalation policy timing & step firing ────────────────────────
  describe('escalation policy (#487)', () => {
    it('fires the immediate (0-delay) step right away and logs it to history', () => {
      seedLegacyAlert({
        upperThreshold: 100,
        escalationPolicy: {
          enabled: true,
          steps: [
            { id: 'step-immediate', channel: 'inApp', delayMinutes: 0 },
            { id: 'step-later', channel: 'webhook', delayMinutes: 15 },
          ],
        },
      })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<
        typeof usePriceContext
      >)
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })

      expect(result.current.alerts[0].escalationState?.firedStepIds).toContain('step-immediate')
      expect(result.current.alerts[0].escalationState?.firedStepIds).not.toContain('step-later')
      const escalationEntry = result.current.alertHistory.find((e) => e.escalation?.stepId === 'step-immediate')
      expect(escalationEntry).toBeDefined()
      expect(escalationEntry?.escalation?.channel).toBe('inApp')
    })

    it('fires a later step once its delay has elapsed, without re-firing the earlier one', () => {
      vi.useFakeTimers()
      const t0 = Date.now()
      seedLegacyAlert({
        upperThreshold: 100,
        cooldownMinutes: 999, // keep the base alert from re-firing/re-arming mid-test
        escalationPolicy: {
          enabled: true,
          steps: [
            { id: 'step-immediate', channel: 'inApp', delayMinutes: 0 },
            { id: 'step-later', channel: 'webhook', delayMinutes: 15 },
          ],
        },
      })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<
        typeof usePriceContext
      >)
      const { result, rerender } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
      expect(result.current.alerts[0].escalationState?.firedStepIds).toEqual(['step-immediate'])

      // Advance 16 minutes and force the evaluation effect to re-run by handing it a
      // fresh (but same-priced) livePrices Map, mirroring a real price tick.
      vi.setSystemTime(t0 + 16 * 60 * 1000)
      act(() => {
        vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<
          typeof usePriceContext
        >)
        rerender()
      })

      expect(result.current.alerts[0].escalationState?.firedStepIds).toEqual(['step-immediate', 'step-later'])
      expect(result.current.alertHistory.filter((e) => e.escalation?.stepId === 'step-immediate')).toHaveLength(1)
    })

    it('resets escalation state once the breach clears, so the next breach restarts the sequence', () => {
      vi.useFakeTimers()
      seedLegacyAlert({
        upperThreshold: 100,
        escalationPolicy: { enabled: true, steps: [{ id: 'step-immediate', channel: 'inApp', delayMinutes: 0 }] },
      })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<
        typeof usePriceContext
      >)
      const { result, rerender } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
      expect(result.current.alerts[0].escalationState).not.toBeNull()

      act(() => {
        vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 10) } as ReturnType<
          typeof usePriceContext
        >)
        rerender()
      })

      expect(result.current.alerts[0].escalationState).toBeNull()
    })

    it('does not start an escalation sequence when the policy is disabled', () => {
      seedLegacyAlert({
        upperThreshold: 100,
        escalationPolicy: { enabled: false, steps: [{ id: 's1', channel: 'inApp', delayMinutes: 0 }] },
      })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<
        typeof usePriceContext
      >)
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertHarness })
      expect(result.current.alerts[0].escalationState).toBeNull()
    })
  })
})
