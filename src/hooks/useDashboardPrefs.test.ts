import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDashboardPrefs, applyOrder } from './useDashboardPrefs'

describe('applyOrder', () => {
  const items = [
    { assetPair: 'A' },
    { assetPair: 'B' },
    { assetPair: 'C' },
  ]

  it('returns items unchanged when no order saved', () => {
    expect(applyOrder(items, [])).toEqual(items)
  })

  it('reorders items according to saved order', () => {
    const result = applyOrder(items, ['C', 'A', 'B'])
    expect(result.map((i) => i.assetPair)).toEqual(['C', 'A', 'B'])
  })

  it('appends items not in saved order at end', () => {
    const result = applyOrder(items, ['B'])
    expect(result.map((i) => i.assetPair)).toEqual(['B', 'A', 'C'])
  })

  it('skips pairs in order that no longer exist', () => {
    const result = applyOrder(items, ['Z', 'A', 'B', 'C'])
    expect(result.map((i) => i.assetPair)).toEqual(['A', 'B', 'C'])
  })
})

describe('useDashboardPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to card view', () => {
    const { result } = renderHook(() => useDashboardPrefs())
    expect(result.current.viewMode).toBe('card')
  })

  it('defaults to empty card order', () => {
    const { result } = renderHook(() => useDashboardPrefs())
    expect(result.current.cardOrder).toEqual([])
  })

  it('persists view mode to localStorage', () => {
    const { result } = renderHook(() => useDashboardPrefs())
    act(() => {
      result.current.setViewMode('table')
    })
    expect(result.current.viewMode).toBe('table')
    expect(localStorage.getItem('dashboard:viewMode')).toBe('table')
  })

  it('persists card order to localStorage', () => {
    const { result } = renderHook(() => useDashboardPrefs())
    act(() => {
      result.current.updateOrder(['BTC/USD', 'ETH/USD'])
    })
    expect(result.current.cardOrder).toEqual(['BTC/USD', 'ETH/USD'])
    expect(JSON.parse(localStorage.getItem('dashboard:cardOrder')!)).toEqual(['BTC/USD', 'ETH/USD'])
  })

  it('loads view mode from localStorage on init', () => {
    localStorage.setItem('dashboard:viewMode', 'table')
    const { result } = renderHook(() => useDashboardPrefs())
    expect(result.current.viewMode).toBe('table')
  })

  it('loads card order from localStorage on init', () => {
    localStorage.setItem('dashboard:cardOrder', JSON.stringify(['ETH/USD', 'BTC/USD']))
    const { result } = renderHook(() => useDashboardPrefs())
    expect(result.current.cardOrder).toEqual(['ETH/USD', 'BTC/USD'])
  })

  it('falls back to card view for invalid localStorage value', () => {
    localStorage.setItem('dashboard:viewMode', 'invalid')
    const { result } = renderHook(() => useDashboardPrefs())
    expect(result.current.viewMode).toBe('card')
  })
})
