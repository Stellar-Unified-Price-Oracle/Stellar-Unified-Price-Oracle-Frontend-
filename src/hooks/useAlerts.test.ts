import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlerts, AlertsProvider } from './useAlerts'
import { usePriceContext } from '../context/PriceContext'
import type { Alert, LivePriceEntry } from '../types'

const STORAGE_KEY = 'price-alerts'

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    livePrices: new Map(),
  })),
}))

function livePricesMap(pair: string, price: number): Map<string, LivePriceEntry> {
  const map = new Map<string, LivePriceEntry>()
  map.set(pair, { data: { assetPair: pair, price, timestamp: Date.now(), confidence: 1, sources: ['test'] } } as LivePriceEntry)
  return map
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
  vi.mocked(usePriceContext).mockReturnValue({ livePrices: new Map() } as ReturnType<typeof usePriceContext>)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAlerts', () => {
  it('starts with empty alerts', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
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
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.activeCount).toBe(1)
  })

  it('adds an alert', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    act(() => {
      result.current.addAlert({
              assetPair: 'ETH/USD',
              upperThreshold: 4000,
              lowerThreshold: 2000,
              divergenceThreshold: null,
              triggerOnce: true,
              active: true,
            })
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
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    act(() => {
      result.current.addAlert({
              assetPair: 'BTC/USD',
              upperThreshold: 60000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
    })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].assetPair).toBe('BTC/USD')
  })

  it('updates an alert', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    let id: string
    act(() => {
      const alert = result.current.addAlert({
              assetPair: 'BTC/USD',
              upperThreshold: 60000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
      id = alert.id
    })
    act(() => {
      result.current.updateAlert(id, { upperThreshold: 65000, triggerOnce: true })
    })
    expect(result.current.alerts[0].upperThreshold).toBe(65000)
    expect(result.current.alerts[0].triggerOnce).toBe(true)
    expect(result.current.alerts[0].lowerThreshold).toBeNull()
  })

  it('removes an alert', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    let id: string
    act(() => {
      const alert = result.current.addAlert({
              assetPair: 'BTC/USD',
              upperThreshold: 60000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
      id = alert.id
    })
    expect(result.current.alerts).toHaveLength(1)
    act(() => {
      result.current.removeAlert(id)
    })
    expect(result.current.alerts).toHaveLength(0)
  })

  it('filters alerts by pair', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    act(() => {
      result.current.addAlert({
              assetPair: 'BTC/USD',
              upperThreshold: 60000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
      result.current.addAlert({
              assetPair: 'ETH/USD',
              upperThreshold: 4000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
    })
    const btcAlerts = result.current.getAlertsForPair('BTC/USD')
    expect(btcAlerts).toHaveLength(1)
    expect(btcAlerts[0].assetPair).toBe('BTC/USD')
    expect(result.current.getAlertsForPair('XRP/USD')).toHaveLength(0)
  })

  it('checks if pair has alerts', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    act(() => {
      result.current.addAlert({
              assetPair: 'BTC/USD',
              upperThreshold: 60000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
    })
    expect(result.current.hasAlertsForPair('BTC/USD')).toBe(true)
    expect(result.current.hasAlertsForPair('ETH/USD')).toBe(false)
  })

  it('excludes inactive alerts from count', () => {
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    act(() => {
      result.current.addAlert({
              assetPair: 'BTC/USD',
              upperThreshold: 60000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: false,
            })
      result.current.addAlert({
              assetPair: 'ETH/USD',
              upperThreshold: 4000,
              lowerThreshold: null,
              divergenceThreshold: null,
              triggerOnce: false,
              active: true,
            })
    })
    expect(result.current.activeCount).toBe(1)
  })

  it('handles invalid localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json')
    const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
    expect(result.current.alerts).toHaveLength(0)
  })

  // ── #485 — transparent legacy migration on load ──────────────────────────
  describe('legacy alert migration (#485)', () => {
    it('attaches a conditionGroup to a legacy alert loaded from storage', () => {
      seedLegacyAlert()
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
      expect(result.current.alerts[0].conditionGroup).not.toBeNull()
      expect(result.current.alerts[0].conditionGroup?.conditions.length).toBeGreaterThan(0)
    })

    it('the migrated condition group evaluates equivalently to the old threshold logic', () => {
      seedLegacyAlert({ upperThreshold: 100, lowerThreshold: 50 })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<typeof usePriceContext>)
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
      expect(result.current.alerts[0].fireCount).toBe(1)
      expect(result.current.alerts[0].lastTriggeredAt).not.toBeNull()
    })

    it('does not lose or alter the original threshold fields while migrating', () => {
      seedLegacyAlert({ upperThreshold: 100, lowerThreshold: 50, cooldownMinutes: 7 })
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
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
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<typeof usePriceContext>)
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })

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
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<typeof usePriceContext>)
      const { result, rerender } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
      expect(result.current.alerts[0].escalationState?.firedStepIds).toEqual(['step-immediate'])

      // Advance 16 minutes and force the evaluation effect to re-run by handing it a
      // fresh (but same-priced) livePrices Map, mirroring a real price tick.
      vi.setSystemTime(t0 + 16 * 60 * 1000)
      act(() => {
        vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<typeof usePriceContext>)
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
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<typeof usePriceContext>)
      const { result, rerender } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
      expect(result.current.alerts[0].escalationState).not.toBeNull()

      act(() => {
        vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 10) } as ReturnType<typeof usePriceContext>)
        rerender()
      })

      expect(result.current.alerts[0].escalationState).toBeNull()
    })

    it('does not start an escalation sequence when the policy is disabled', () => {
      seedLegacyAlert({ upperThreshold: 100, escalationPolicy: { enabled: false, steps: [{ id: 's1', channel: 'inApp', delayMinutes: 0 }] } })
      vi.mocked(usePriceContext).mockReturnValue({ livePrices: livePricesMap('BTC/USD', 150) } as ReturnType<typeof usePriceContext>)
      const { result } = renderHook(() => useAlerts(), { wrapper: AlertsProvider })
      expect(result.current.alerts[0].escalationState).toBeNull()
    })
  })
})
