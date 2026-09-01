/**
 * Worker Pool — `src/workers/workerPool.ts`
 *
 * Manages a fixed-size pool of Web Workers of a single type. Tasks submitted
 * to the pool are queued and dispatched to the next idle worker. When a worker
 * completes its task the next queued task is dispatched immediately.
 *
 * Graceful degradation: if the browser does not support `Worker` the pool
 * signals unavailability and callers can fall back to main-thread execution.
 *
 * Usage
 * -----
 * ```ts
 * const pool = new WorkerPool(() => new Worker(
 *   new URL('./export.worker.ts', import.meta.url),
 *   { type: 'module' },
 * ), { size: 2 })
 *
 * const proxy = pool.acquire()          // blocks until a worker is free
 * const result = await proxy.exportHistory(input)
 * pool.release(proxy)
 * ```
 */

import { wrap, type Remote } from 'comlink'

export interface WorkerPoolOptions {
  /** Number of workers to spawn. Defaults to `navigator.hardwareConcurrency` capped at 4. */
  size?: number
}

interface PoolEntry<T extends object> {
  worker: Worker
  proxy: Remote<T>
  busy: boolean
}

type ResolveAcquire<T extends object> = (proxy: Remote<T>) => void

/**
 * A pool of Comlink-wrapped Web Workers.
 *
 * `T` is the class type exposed by the worker via `comlink.expose()`.
 */
export class WorkerPool<T extends object> {
  /** True when the current environment supports Web Workers. */
  static readonly supported: boolean = typeof Worker !== 'undefined'

  private readonly entries: PoolEntry<T>[] = []
  private readonly queue: ResolveAcquire<T>[] = []

  constructor(
    /** Factory that creates a new raw `Worker`. Called `size` times. */
    factory: () => Worker,
    options: WorkerPoolOptions = {},
  ) {
    if (!WorkerPool.supported) return

    const size = options.size ?? Math.min(navigator.hardwareConcurrency ?? 2, 4)

    for (let i = 0; i < size; i++) {
      const worker = factory()
      const proxy = wrap<T>(worker)
      this.entries.push({ worker, proxy, busy: false })
    }
  }

  /**
   * Returns a promise that resolves to a free worker proxy.
   * If all workers are busy the promise queues and resolves as soon as a
   * worker becomes available.
   */
  acquire(): Promise<Remote<T>> {
    const free = this.entries.find((e) => !e.busy)
    if (free) {
      free.busy = true
      return Promise.resolve(free.proxy)
    }
    return new Promise<Remote<T>>((resolve) => {
      this.queue.push(resolve)
    })
  }

  /**
   * Marks the proxy as idle and dispatches the next queued task if any.
   */
  release(proxy: Remote<T>): void {
    const entry = this.entries.find((e) => e.proxy === proxy)
    if (!entry) return

    const next = this.queue.shift()
    if (next) {
      // Keep busy and hand the same proxy to the next waiter
      next(entry.proxy)
    } else {
      entry.busy = false
    }
  }

  /**
   * Terminates all workers in the pool and clears any pending queue.
   * Outstanding `acquire()` promises will never resolve after this call.
   */
  terminate(): void {
    for (const entry of this.entries) {
      entry.worker.terminate()
    }
    this.entries.length = 0
    this.queue.length = 0
  }

  /** Number of workers currently executing a task. */
  get busyCount(): number {
    return this.entries.filter((e) => e.busy).length
  }

  /** Total number of workers in the pool. */
  get size(): number {
    return this.entries.length
  }
}

/**
 * Convenience helper: acquire a proxy, run a task, then release.
 *
 * ```ts
 * const result = await withWorker(pool, (proxy) => proxy.exportPrices(input))
 * ```
 */
export async function withWorker<T extends object, R>(
  pool: WorkerPool<T>,
  task: (proxy: Remote<T>) => Promise<R>,
): Promise<R> {
  const proxy = await pool.acquire()
  try {
    return await task(proxy)
  } finally {
    pool.release(proxy)
  }
}
