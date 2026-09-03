import { describe, expect, it, vi } from 'vitest'
import { PreloadLruCache } from './preloadCache'

describe('PreloadLruCache', () => {
  it('reuses a cached chunk promise', async () => {
    const cache = new PreloadLruCache(2)
    const loader = vi.fn().mockResolvedValue({ loaded: true })

    const first = cache.load('chart', loader)
    const second = cache.load('chart', loader)

    expect(first).toBe(second)
    expect(loader).toHaveBeenCalledTimes(1)
    await expect(first).resolves.toEqual({ loaded: true })
  })

  it('evicts the least recently used preload', () => {
    const cache = new PreloadLruCache(2)
    const loader = () => Promise.resolve({})

    cache.load('chart', loader)
    cache.load('table', loader)
    cache.load('chart', loader)
    cache.load('preferences', loader)

    expect(cache.keys()).toEqual(['chart', 'preferences'])
    expect(cache.size).toBe(2)
  })

  it('removes rejected preloads so they can be retried', async () => {
    const cache = new PreloadLruCache(1)
    const loader = vi
      .fn<() => Promise<object>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ loaded: true })

    await expect(cache.load('chart', loader)).rejects.toThrow('network')
    await expect(cache.load('chart', loader)).resolves.toEqual({ loaded: true })
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
