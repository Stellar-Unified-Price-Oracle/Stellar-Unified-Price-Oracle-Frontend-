import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlerts, AlertsProvider } from './useAlerts'

const STORAGE_KEY = 'price-alerts'

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    livePrices: new Map(),
  })),
}))

beforeEach(() => {
  localStorage.clear()
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
        triggerOnce: false,
        active: true,
      })
      result.current.addAlert({
        assetPair: 'ETH/USD',
        upperThreshold: 4000,
        lowerThreshold: null,
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
        triggerOnce: false,
        active: false,
      })
      result.current.addAlert({
        assetPair: 'ETH/USD',
        upperThreshold: 4000,
        lowerThreshold: null,
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
})
