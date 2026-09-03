import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIdbQuery, useIdbMutation } from './useIdbQuery'
import { idbCache } from './useIndexedDB'

beforeEach(() => {
  idbCache._reset()
  idbCache._disableSyncQueue()
  vi.clearAllMocks()
})

afterEach(() => {
  idbCache._reset()
})

describe('useIdbQuery', () => {
  it('returns null data and loading state initially', async () => {
    const { result } = renderHook(() => useIdbQuery<string>('prices', 'test-key'))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns data after IDB load completes', async () => {
    await idbCache.set('prices', 'test-key', 'hello')

    const { result } = renderHook(() => useIdbQuery<string>('prices', 'test-key'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBe('hello')
  })

  it('returns null for non-existent key', async () => {
    const { result } = renderHook(() => useIdbQuery<string>('prices', 'missing'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
  })
})

describe('useIdbMutation', () => {
  it('provides set, remove, and clear functions', () => {
    const { result } = renderHook(() => useIdbMutation())

    expect(typeof result.current.set).toBe('function')
    expect(typeof result.current.remove).toBe('function')
    expect(typeof result.current.clear).toBe('function')
  })

  it('set writes to IDB', async () => {
    const { result } = renderHook(() => useIdbMutation())

    await act(async () => {
      await result.current.set('prices', 'key1', 'value1')
    })

    const value = await idbCache.get<string>('prices', 'key1')
    expect(value).toBe('value1')
  })

  it('remove deletes from IDB', async () => {
    await idbCache.set('prices', 'key2', 'value2')
    const { result } = renderHook(() => useIdbMutation())

    await act(async () => {
      await result.current.remove('prices', 'key2')
    })

    const value = await idbCache.get<string>('prices', 'key2')
    expect(value).toBeNull()
  })
})
