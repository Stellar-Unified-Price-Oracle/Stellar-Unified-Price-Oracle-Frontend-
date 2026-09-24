export type ChunkLoader<T> = () => Promise<T>

/**
 * Keeps a bounded set of preload promises. Native ESM still owns the compiled
 * module cache; this LRU only caps the strong references retained by our
 * speculative preloader.
 */
export class PreloadLruCache {
  private readonly entries = new Map<string, Promise<unknown>>()

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Preload cache capacity must be a positive integer')
    }
  }

  load<T>(key: string, loader: ChunkLoader<T>): Promise<T> {
    const cached = this.entries.get(key) as Promise<T> | undefined
    if (cached) {
      this.entries.delete(key)
      this.entries.set(key, cached)
      return cached
    }

    const promise = loader()
    this.entries.set(key, promise)

    promise.catch(() => {
      if (this.entries.get(key) === promise) {
        this.entries.delete(key)
      }
    })

    if (this.entries.size > this.capacity) {
      const leastRecentlyUsed = this.entries.keys().next().value
      if (leastRecentlyUsed !== undefined) {
        this.entries.delete(leastRecentlyUsed)
      }
    }

    return promise
  }

  keys(): string[] {
    return [...this.entries.keys()]
  }

  get size(): number {
    return this.entries.size
  }
}

const chunkPreloadCache = new PreloadLruCache(6)

export function preloadChunk<T>(key: string, loader: ChunkLoader<T>): Promise<T> {
  return chunkPreloadCache.load(key, loader)
}

/** Schedules non-critical preloading without competing with the first render. */
export function scheduleIdlePreload(task: () => void, timeout = 2000): () => void {
  if (typeof window === 'undefined') return () => {}

  if (window.requestIdleCallback) {
    const handle = window.requestIdleCallback(task, { timeout })
    return () => window.cancelIdleCallback(handle)
  }

  const handle = window.setTimeout(task, timeout)
  return () => window.clearTimeout(handle)
}
