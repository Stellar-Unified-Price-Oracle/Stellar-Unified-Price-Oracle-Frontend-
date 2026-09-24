import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns initialValue when no value is stored', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    expect(result.current.value).toBe('default')
    expect(result.current.error).toBeNull()
  })

  it('reads existing value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'))
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    expect(result.current.value).toBe('stored-value')
  })

  it('writes a new value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))

    act(() => {
      result.current.setValue('updated')
    })

    expect(result.current.value).toBe('updated')
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'))
  })

  it('supports functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-counter', 0))

    act(() => {
      result.current.setValue((prev) => prev + 1)
    })

    expect(result.current.value).toBe(1)
    expect(localStorage.getItem('test-counter')).toBe(JSON.stringify(1))
  })

  it('removes the key from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))

    act(() => {
      result.current.remove()
    })

    expect(result.current.value).toBe('default')
    expect(localStorage.getItem('test-key')).toBeNull()
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('test-key', '{corrupt')
    const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'))

    expect(result.current.value).toBe('fallback')
    expect(result.current.error).not.toBeNull()
  })

  it('handles quota exceeded error on write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    })

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))

    act(() => {
      result.current.setValue('too-much-data')
    })

    // The value in state still updates even though localStorage write failed
    expect(result.current.value).toBe('too-much-data')
    expect(result.current.error).not.toBeNull()
    // jsdom's DOMException.message may be empty; just verify an error is present
    expect(typeof result.current.error).toBe('string')

    setItemSpy.mockRestore()
  })

  it('updates when the key changes', () => {
    localStorage.setItem('key-a', JSON.stringify('value-a'))
    localStorage.setItem('key-b', JSON.stringify('value-b'))

    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage(key, 'default'),
      { initialProps: { key: 'key-a' } },
    )

    expect(result.current.value).toBe('value-a')

    rerender({ key: 'key-b' })
    expect(result.current.value).toBe('value-b')
  })

  it('listens to cross-tab storage events', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))

    act(() => {
      localStorage.setItem('test-key', JSON.stringify('from-another-tab'))
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'test-key', newValue: JSON.stringify('from-another-tab') }),
      )
    })

    expect(result.current.value).toBe('from-another-tab')
  })

  it('does not react to storage events for other keys', () => {
    const { result } = renderHook(() => useLocalStorage('my-key', 'default'))

    act(() => {
      localStorage.setItem('other-key', JSON.stringify('ignored'))
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'other-key', newValue: JSON.stringify('ignored') }),
      )
    })

    expect(result.current.value).toBe('default')
  })
})
