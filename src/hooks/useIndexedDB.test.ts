import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { idbCache } from './useIndexedDB'

beforeEach(() => {
  idbCache._reset()
  idbCache._disableSyncQueue()
  vi.clearAllMocks()
})

afterEach(() => {
  idbCache._reset()
})

describe('idbCache', () => {
  it('set and get work correctly', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })
    const result = await idbCache.get('prices', 'btc')
    expect(result).toEqual({ price: 50000 })
  })

  it('returns null for non-existent key', async () => {
    const result = await idbCache.get('prices', 'nonexistent')
    expect(result).toBeNull()
  })

  it('returns null for expired entry', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })
    const result = await idbCache.get('prices', 'btc', 0) // ttl=0 means always expired
    expect(result).toBeNull()
  })

  it('delete removes an entry', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })
    await idbCache.delete('prices', 'btc')
    const result = await idbCache.get('prices', 'btc')
    expect(result).toBeNull()
  })

  it('clear removes all entries in a store', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })
    await idbCache.set('prices', 'eth', { price: 3000 })
    await idbCache.clear('prices')
    const btc = await idbCache.get('prices', 'btc')
    const eth = await idbCache.get('prices', 'eth')
    expect(btc).toBeNull()
    expect(eth).toBeNull()
  })

  it('subscribe notifies on set', async () => {
    const callback = vi.fn()
    idbCache.subscribe('prices', 'btc', callback)

    await idbCache.set('prices', 'btc', { price: 50000 })

    expect(callback).toHaveBeenCalledWith({ price: 50000 })
  })

  it('subscribe notifies on delete', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })

    const callback = vi.fn()
    idbCache.subscribe('prices', 'btc', callback)

    await idbCache.delete('prices', 'btc')

    expect(callback).toHaveBeenCalledWith(null)
  })

  it('unsubscribe stops notifications', async () => {
    const callback = vi.fn()
    const unsubscribe = idbCache.subscribe('prices', 'btc', callback)

    unsubscribe()

    await idbCache.set('prices', 'btc', { price: 50000 })

    expect(callback).not.toHaveBeenCalled()
  })

  it('fetchWithCache cache-first returns cached data', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })

    const fetcher = vi.fn().mockResolvedValue({ price: 60000 })
    const result = await idbCache.fetchWithCache('prices', 'btc', fetcher, {
      strategy: 'cache-first',
    })

    expect(result).toEqual({ price: 50000 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fetchWithCache cache-first fetches when no cache', async () => {
    const fetcher = vi.fn().mockResolvedValue({ price: 60000 })
    const result = await idbCache.fetchWithCache('prices', 'cache-miss-key', fetcher, {
      strategy: 'cache-first',
    })

    expect(result).toEqual({ price: 60000 })
    expect(fetcher).toHaveBeenCalled()
  })

  it('fetchWithCache network-first returns network data', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })

    const fetcher = vi.fn().mockResolvedValue({ price: 60000 })
    const result = await idbCache.fetchWithCache('prices', 'btc', fetcher, {
      strategy: 'network-first',
    })

    expect(result).toEqual({ price: 60000 })
    expect(fetcher).toHaveBeenCalled()
  })

  it('fetchWithCache network-first falls back to cache', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })

    const fetcher = vi.fn().mockRejectedValue(new Error('network error'))
    const result = await idbCache.fetchWithCache('prices', 'btc', fetcher, {
      strategy: 'network-first',
    })

    expect(result).toEqual({ price: 50000 })
  })

  it('fetchWithCache stale-while-revalidate returns cache and fetches in bg', async () => {
    await idbCache.set('prices', 'btc', { price: 50000 })

    const fetcher = vi.fn().mockResolvedValue({ price: 60000 })
    const result = await idbCache.fetchWithCache('prices', 'btc', fetcher, {
      strategy: 'stale-while-revalidate',
    })

    expect(result).toEqual({ price: 50000 })
    expect(fetcher).toHaveBeenCalled()
  })

  it('works across different stores', async () => {
    await idbCache.set('prices', 'key1', 'price-value')
    await idbCache.set('history', 'key1', 'history-value')
    await idbCache.set('preferences', 'key1', 'prefs-value')

    expect(await idbCache.get('prices', 'key1')).toBe('price-value')
    expect(await idbCache.get('history', 'key1')).toBe('history-value')
    expect(await idbCache.get('preferences', 'key1')).toBe('prefs-value')

    await idbCache.clear('prices')
    expect(await idbCache.get('prices', 'key1')).toBeNull()
    expect(await idbCache.get('history', 'key1')).toBe('history-value')
  })

  it('subscribe wildcard fires for any key in store', async () => {
    const callback = vi.fn()
    idbCache.subscribe('prices', '*', callback)

    await idbCache.set('prices', 'btc', { price: 50000 })
    await idbCache.set('prices', 'eth', { price: 3000 })

    expect(callback).toHaveBeenCalledTimes(2)
  })
})
