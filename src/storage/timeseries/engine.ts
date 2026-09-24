/**
 * Time-series storage engine.
 *
 * On top of the shared IndexedDB database (`stellar-oracle`) the engine adds two
 * object stores:
 *
 * - `tsPoints` — one row per `(series, tier, t)`, keyed by that compound key so
 *   range scans over a tier are a single `getAll`/cursor on the primary key.
 * - `tsSeries` — one row per concrete series recording its resolved retention,
 *   so maintenance still trims series whose descriptor has since been removed.
 *
 * Responsibilities:
 * - **Retention** — each tier is trimmed to its window (`enforceRetention`).
 * - **Compaction** — complete raw buckets roll into hourly, hourly into daily
 *   (`compactSeries`), streamed inside one transaction per tier so a crash can
 *   never leave a half-aggregated bucket.
 * - **Query planning** — {@link planQuery} picks the cheapest tier for a range.
 *
 * Every method is failure-tolerant: storage being unavailable resolves to a
 * no-op / empty result rather than throwing into a render.
 */

import { openCacheConnection } from '../../hooks/useIndexedDB'
import { DEFAULT_RETENTION, DEFAULT_ROLLUP, MAINTENANCE, SERIES_DESCRIPTORS } from './config'
import { planQuery } from './planner'
import { aggregate, bucketStart, DAY_MS, HOUR_MS } from './rollup'
import type {
  QueryPlan,
  QuerySpec,
  RetentionPolicy,
  RollupPolicy,
  SeriesDescriptor,
  SeriesStats,
  TsObservation,
  TsPoint,
  TsTier,
} from './types'

/** Object store holding every time-series point. */
export const TS_POINTS_STORE = 'tsPoints'
/** Object store holding per-series registrations (retention + base id). */
export const TS_SERIES_STORE = 'tsSeries'

const TIER_LIST: readonly TsTier[] = ['raw', 'hourly', 'daily']

interface SeriesRegistration {
  series: string
  baseId: string
  retention: RetentionPolicy
  registeredAt: number
}

export interface TimeSeriesEngineOptions {
  /** Database provider; overridable in tests. */
  openDb?: () => Promise<IDBDatabase>
  /** Clock; overridable in tests. */
  now?: () => number
}

export interface TimeSeriesEngine {
  /** Registers every app descriptor (idempotent) and runs one maintenance pass. */
  initialize(): Promise<void>
  /** Registers a descriptor in memory (no DB write until data is appended). */
  register(descriptor: SeriesDescriptor<never>): void
  /** Appends one payload to a series, landing it in the raw tier. */
  append(seriesId: string, payload: unknown): Promise<void>
  /** Appends many payloads to a series in a single transaction. */
  appendMany(seriesId: string, payloads: readonly unknown[]): Promise<void>
  /** Plans and executes a range query, returning raw/rolled points. */
  query(spec: QuerySpec): Promise<TsPoint[]>
  /** Pure planner access for callers that want the chosen tier. */
  plan(spec: QuerySpec): QueryPlan
  /** Occupancy of one series across all tiers. */
  stats(seriesId: string): Promise<SeriesStats | null>
  /** Rolls complete buckets one tier down. Returns the number of source points consumed. */
  compact(seriesId: string): Promise<number>
  /** Deletes points older than each tier's retention window. */
  enforceRetention(seriesId: string): Promise<number>
  /** Compacts and trims one series (or every known series when omitted). */
  maintain(seriesId?: string): Promise<void>
  /** Removes every point and the registration for one series. */
  clear(seriesId: string): Promise<void>
  /** Removes every series the engine owns (used by "clear all data"). */
  clearAll(): Promise<void>
  /** Subscribes to writes for a series (or its family). Returns an unsubscribe fn. */
  subscribe(seriesId: string, listener: () => void): () => void
  /** Test helper: drops in-memory state and pending maintenance timers. */
  _reset(): void
}

function baseIdOf(seriesId: string): string {
  const index = seriesId.indexOf(':')
  return index === -1 ? seriesId : seriesId.slice(0, index)
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Cross-tab notification channel. Guarded — jsdom has no BroadcastChannel. */
const CHANNEL_NAME = 'stellar-oracle-timeseries'

export function createTimeSeriesEngine(options: TimeSeriesEngineOptions = {}): TimeSeriesEngine {
  const openDb = options.openDb ?? openCacheConnection
  const now = options.now ?? (() => Date.now())

  const descriptors = new Map<string, SeriesDescriptor<never>>()
  const persisted = new Set<string>()
  const listeners = new Map<string, Set<() => void>>()

  let maintainTimer: ReturnType<typeof setTimeout> | null = null
  let initialized = false
  let channel: BroadcastChannel | null = null
  let channelReady = false

  function getChannel(): BroadcastChannel | null {
    if (channelReady) return channel
    channelReady = true
    if (typeof BroadcastChannel === 'undefined') return null
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent) => {
        const seriesId = (event.data as { seriesId?: string } | null)?.seriesId
        if (seriesId) emit(seriesId, false)
      }
    } catch {
      channel = null
    }
    return channel
  }

  function emit(seriesId: string, broadcast: boolean): void {
    for (const key of new Set([seriesId, baseIdOf(seriesId)])) {
      const set = listeners.get(key)
      if (set) for (const listener of set) listener()
    }
    if (broadcast) {
      try {
        getChannel()?.postMessage({ seriesId })
      } catch {
        /* channel closed */
      }
    }
  }

  function descriptorFor(seriesId: string): SeriesDescriptor<never> | undefined {
    return descriptors.get(seriesId) ?? descriptors.get(baseIdOf(seriesId))
  }

  function resolveRetention(seriesId: string): RetentionPolicy {
    const descriptor = descriptorFor(seriesId)
    return { ...DEFAULT_RETENTION, ...descriptor?.retention }
  }

  function resolveRollup(seriesId: string): RollupPolicy {
    const descriptor = descriptorFor(seriesId)
    return { ...DEFAULT_ROLLUP, ...descriptor?.rollup }
  }

  function toPoint(seriesId: string, observation: TsObservation): TsPoint {
    return {
      series: seriesId,
      tier: 'raw',
      t: Math.floor(observation.t),
      v: observation.v,
      n: 1,
      ...(observation.meta ? { meta: observation.meta } : {}),
    }
  }

  async function ensureRegistered(db: IDBDatabase, seriesId: string): Promise<void> {
    if (persisted.has(seriesId)) return
    persisted.add(seriesId)
    try {
      const record: SeriesRegistration = {
        series: seriesId,
        baseId: baseIdOf(seriesId),
        retention: resolveRetention(seriesId),
        registeredAt: now(),
      }
      const tx = db.transaction(TS_SERIES_STORE, 'readwrite')
      tx.objectStore(TS_SERIES_STORE).put(record)
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      })
    } catch {
      /* registration is best-effort */
    }
  }

  function readPoints(db: IDBDatabase, series: string, tier: TsTier, from: number, to: number): Promise<TsPoint[]> {
    try {
      const store = db.transaction(TS_POINTS_STORE, 'readonly').objectStore(TS_POINTS_STORE)
      return request<TsPoint[]>(store.getAll(IDBKeyRange.bound([series, tier, from], [series, tier, to])))
    } catch {
      return Promise.resolve([])
    }
  }

  function putPoints(db: IDBDatabase, points: readonly TsPoint[]): Promise<void> {
    if (points.length === 0) return Promise.resolve()
    try {
      const tx = db.transaction(TS_POINTS_STORE, 'readwrite')
      const store = tx.objectStore(TS_POINTS_STORE)
      for (const point of points) store.put(point)
      return new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      })
    } catch {
      return Promise.resolve()
    }
  }

  function countPoints(db: IDBDatabase, series: string, tier: TsTier): Promise<number> {
    try {
      const store = db.transaction(TS_POINTS_STORE, 'readonly').objectStore(TS_POINTS_STORE)
      const range = IDBKeyRange.bound([series, tier], [series, tier, Infinity])
      return request<number>(store.count(range)).catch(() => 0)
    } catch {
      return Promise.resolve(0)
    }
  }

  /** Deletes points of `tier` with `t < cutoff`. Returns the rows removed. */
  function deleteBefore(db: IDBDatabase, series: string, tier: TsTier, cutoff: number): Promise<number> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(TS_POINTS_STORE, 'readwrite')
        const store = tx.objectStore(TS_POINTS_STORE)
        const range = IDBKeyRange.bound([series, tier], [series, tier, cutoff], false, true)
        let removed = 0
        const req = store.openCursor(range)
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) return
          cursor.delete()
          removed += 1
          cursor.continue()
        }
        req.onerror = () => resolve(removed)
        tx.oncomplete = () => resolve(removed)
        tx.onerror = () => resolve(removed)
        tx.onabort = () => resolve(removed)
      } catch {
        resolve(0)
      }
    })
  }

  /** Edge point of one tier (oldest when ascending, newest when descending). */
  function tierEdge(
    db: IDBDatabase,
    seriesId: string,
    tier: TsTier,
    direction: IDBCursorDirection,
  ): Promise<TsPoint | null> {
    try {
      const store = db.transaction(TS_POINTS_STORE, 'readonly').objectStore(TS_POINTS_STORE)
      const range = IDBKeyRange.bound([seriesId, tier], [seriesId, tier, Infinity])
      const req = store.openCursor(range, direction)
      return new Promise<TsPoint | null>((resolve) => {
        req.onsuccess = () => resolve((req.result?.value as TsPoint | undefined) ?? null)
        req.onerror = () => resolve(null)
      })
    } catch {
      return Promise.resolve(null)
    }
  }

  /**
   * Oldest/newest point across every tier. Scans each tier's edge and takes the
   * extreme by timestamp — tier names are strings, so relying on the compound
   * key's implicit tier ordering would silently depend on alphabetical order.
   */
  async function edgePoint(db: IDBDatabase, seriesId: string, ahead: boolean): Promise<TsPoint | null> {
    let best: TsPoint | null = null
    for (const tier of TIER_LIST) {
      const point = await tierEdge(db, seriesId, tier, ahead ? 'next' : 'prev')
      if (!point) continue
      if (!best || (ahead ? point.t < best.t : point.t > best.t)) best = point
    }
    return best
  }

  /**
   * Streams `srcTier` points older than `cutoff` (keys are time-ordered), writes
   * the aggregated `dstTier` bucket when the bucket changes, and deletes each
   * source row as it goes — all inside one transaction, so an aborted pass
   * leaves the source intact and a re-run recomputes the identical bucket.
   */
  function rollUpTier(
    db: IDBDatabase,
    series: string,
    srcTier: TsTier,
    dstTier: TsTier,
    intervalMs: number,
    kind: RollupPolicy['rawToHourly'],
    cutoff: number,
  ): Promise<number> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(TS_POINTS_STORE, 'readwrite')
        const store = tx.objectStore(TS_POINTS_STORE)
        const range = IDBKeyRange.bound([series, srcTier], [series, srcTier, cutoff], false, true)

        let consumed = 0
        let bucket: number | null = null
        let bucketPoints: TsPoint[] = []

        const flush = () => {
          if (bucket === null || bucketPoints.length === 0) return
          const newest = bucketPoints[bucketPoints.length - 1]
          const point: TsPoint = {
            series,
            tier: dstTier,
            t: bucket,
            v: aggregate(bucketPoints, kind),
            n: bucketPoints.reduce((sum, p) => sum + p.n, 0),
            ...(newest.meta ? { meta: newest.meta } : {}),
          }
          store.put(point)
          bucket = null
          bucketPoints = []
        }

        const req = store.openCursor(range)
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) {
            flush()
            return
          }
          const point = cursor.value as TsPoint
          const nextBucket = bucketStart(point.t, intervalMs)
          if (bucket !== null && nextBucket !== bucket) flush()
          bucket = nextBucket
          bucketPoints.push(point)
          consumed += 1
          cursor.delete()
          cursor.continue()
        }
        req.onerror = () => resolve(consumed)

        tx.oncomplete = () => resolve(consumed)
        tx.onerror = () => resolve(consumed)
        tx.onabort = () => resolve(consumed)
      } catch {
        resolve(0)
      }
    })
  }

  async function compactSeries(db: IDBDatabase, seriesId: string): Promise<number> {
    const rollup = resolveRollup(seriesId)
    const clock = now()
    const hourCutoff = bucketStart(clock, HOUR_MS)
    let consumed = await rollUpTier(db, seriesId, 'raw', 'hourly', HOUR_MS, rollup.rawToHourly, hourCutoff)
    const dayCutoff = bucketStart(clock, DAY_MS)
    consumed += await rollUpTier(db, seriesId, 'hourly', 'daily', DAY_MS, rollup.hourlyToDaily, dayCutoff)
    return consumed
  }

  async function enforceRetentionSeries(db: IDBDatabase, seriesId: string): Promise<number> {
    const retention = resolveRetention(seriesId)
    const clock = now()
    let removed = 0
    for (const tier of TIER_LIST) {
      removed += await deleteBefore(db, seriesId, tier, clock - retention[tier])
    }
    return removed
  }

  async function knownSeries(db: IDBDatabase): Promise<string[]> {
    const ids = new Set<string>(persisted)
    try {
      const store = db.transaction(TS_SERIES_STORE, 'readonly').objectStore(TS_SERIES_STORE)
      const records = await request<SeriesRegistration[]>(store.getAll())
      for (const record of records) ids.add(record.series)
    } catch {
      /* store may not exist yet */
    }
    return [...ids]
  }

  function scheduleMaintenance(): void {
    if (maintainTimer !== null) clearTimeout(maintainTimer)
    maintainTimer = setTimeout(() => {
      maintainTimer = null
      void engine.maintain()
    }, MAINTENANCE.debounceMs)
  }

  const engine: TimeSeriesEngine = {
    async initialize() {
      for (const descriptor of SERIES_DESCRIPTORS) engine.register(descriptor)
      if (initialized) return
      initialized = true
      // One pass at boot so retention is enforced even when nothing is written.
      void engine.maintain()
    },

    register(descriptor) {
      descriptors.set(descriptor.id, descriptor)
    },

    async append(seriesId, payload) {
      await engine.appendMany(seriesId, [payload])
    },

    async appendMany(seriesId, payloads) {
      if (payloads.length === 0) return
      try {
        const db = await openDb()
        const descriptor = descriptorFor(seriesId)
        const points: TsPoint[] = []
        for (const payload of payloads) {
          const observation = descriptor ? descriptor.toObservation(payload as never) : (payload as TsObservation)
          if (!observation || typeof observation.t !== 'number' || typeof observation.v !== 'number') continue
          if (!Number.isFinite(observation.t) || !Number.isFinite(observation.v)) continue
          points.push(toPoint(seriesId, observation))
        }
        if (points.length === 0) return
        await ensureRegistered(db, seriesId)
        await putPoints(db, points)
        emit(seriesId, true)
        scheduleMaintenance()
      } catch {
        /* writes are best-effort; a failed append must never break a render */
      }
    },

    async query(spec) {
      const plan = planQuery(spec)
      try {
        const db = await openDb()
        return await readPoints(db, plan.series, plan.tier, plan.from, plan.to)
      } catch {
        return []
      }
    },

    plan(spec) {
      return planQuery(spec)
    },

    async stats(seriesId) {
      try {
        const db = await openDb()
        const points = {
          raw: await countPoints(db, seriesId, 'raw'),
          hourly: await countPoints(db, seriesId, 'hourly'),
          daily: await countPoints(db, seriesId, 'daily'),
        }
        const oldest = await edgePoint(db, seriesId, true)
        const newest = await edgePoint(db, seriesId, false)
        return {
          series: seriesId,
          retention: resolveRetention(seriesId),
          points,
          oldest: oldest?.t ?? null,
          newest: newest?.t ?? null,
        }
      } catch {
        return null
      }
    },

    async compact(seriesId) {
      try {
        const db = await openDb()
        return await compactSeries(db, seriesId)
      } catch {
        return 0
      }
    },

    async enforceRetention(seriesId) {
      try {
        const db = await openDb()
        return await enforceRetentionSeries(db, seriesId)
      } catch {
        return 0
      }
    },

    async maintain(seriesId) {
      try {
        const db = await openDb()
        const targets = seriesId ? [seriesId] : await knownSeries(db)
        for (const target of targets) {
          await compactSeries(db, target)
          await enforceRetentionSeries(db, target)
        }
      } catch {
        /* maintenance is best-effort */
      }
    },

    async clear(seriesId) {
      try {
        const db = await openDb()
        for (const tier of TIER_LIST) {
          await new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(TS_POINTS_STORE, 'readwrite')
              const store = tx.objectStore(TS_POINTS_STORE)
              store.delete(IDBKeyRange.bound([seriesId, tier], [seriesId, tier, Infinity]))
              tx.oncomplete = () => resolve()
              tx.onerror = () => resolve()
              tx.onabort = () => resolve()
            } catch {
              resolve()
            }
          })
        }
        const tx = db.transaction(TS_SERIES_STORE, 'readwrite')
        tx.objectStore(TS_SERIES_STORE).delete(seriesId)
        await new Promise<void>((resolve) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
          tx.onabort = () => resolve()
        })
        persisted.delete(seriesId)
        emit(seriesId, true)
      } catch {
        /* clear is best-effort */
      }
    },

    async clearAll() {
      try {
        const db = await openDb()
        for (const storeName of [TS_POINTS_STORE, TS_SERIES_STORE]) {
          await new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(storeName, 'readwrite')
              tx.objectStore(storeName).clear()
              tx.oncomplete = () => resolve()
              tx.onerror = () => resolve()
              tx.onabort = () => resolve()
            } catch {
              resolve()
            }
          })
        }
        persisted.clear()
      } catch {
        /* clear is best-effort */
      }
    },

    subscribe(seriesId, listener) {
      const key = baseIdOf(seriesId)
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(listener)
      getChannel()
      return () => {
        const current = listeners.get(key)
        if (!current) return
        current.delete(listener)
        if (current.size === 0) listeners.delete(key)
      }
    },

    _reset() {
      if (maintainTimer !== null) {
        clearTimeout(maintainTimer)
        maintainTimer = null
      }
      if (channel) {
        try {
          channel.close()
        } catch {
          /* already closed */
        }
        channel = null
        channelReady = false
      }
      descriptors.clear()
      persisted.clear()
      listeners.clear()
      initialized = false
    },
  }

  return engine
}

/** App-wide engine instance backed by the shared cache database. */
export const timeSeries = createTimeSeriesEngine()
