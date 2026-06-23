import { useState, useEffect, useCallback, useRef } from 'react'
import type { SourceName } from '../types'

export interface LatencyPoint {
  timestamp: number
  latency: number
}

export interface SourceHealthData {
  source: SourceName
  status: 'healthy' | 'degraded' | 'down'
  lastUpdate: number | null
  latency: number | null
  uptime24h: number
  activeFeeds: number
  latencyHistory: LatencyPoint[]
}

// Simulated baseline characteristics per source
const SOURCE_CONFIG: Record<
  SourceName,
  { baseFeedCount: number; baseLatency: number; baseUptime: number; failChance: number }
> = {
  chainlink: { baseFeedCount: 24, baseLatency: 120, baseUptime: 99.8, failChance: 0.01 },
  redstone: { baseFeedCount: 20, baseLatency: 450, baseUptime: 95.2, failChance: 0.08 },
  band: { baseFeedCount: 22, baseLatency: 200, baseUptime: 99.1, failChance: 0.02 },
  reflector: { baseFeedCount: 0, baseLatency: null as unknown as number, baseUptime: 72.3, failChance: 0.4 },
}

const SOURCES: SourceName[] = ['chainlink', 'redstone', 'band', 'reflector']
const HISTORY_POINTS = 20
const POLL_INTERVAL = 5_000

function deriveStatus(latency: number | null, uptime: number): SourceHealthData['status'] {
  if (latency === null || uptime < 80) return 'down'
  if (latency > 350 || uptime < 97) return 'degraded'
  return 'healthy'
}

function buildInitialHistory(source: SourceName): LatencyPoint[] {
  const cfg = SOURCE_CONFIG[source]
  if (cfg.baseFeedCount === 0) return []
  const now = Date.now()
  return Array.from({ length: HISTORY_POINTS }, (_, i) => ({
    timestamp: now - (HISTORY_POINTS - i) * POLL_INTERVAL,
    latency: Math.max(10, cfg.baseLatency + (Math.random() - 0.5) * cfg.baseLatency * 0.4),
  }))
}

function buildInitialData(): SourceHealthData[] {
  return SOURCES.map((source) => {
    const cfg = SOURCE_CONFIG[source]
    const isDown = source === 'reflector'
    const latency = isDown ? null : Math.max(10, cfg.baseLatency + (Math.random() - 0.5) * 40)
    return {
      source,
      status: deriveStatus(latency, cfg.baseUptime),
      lastUpdate: isDown ? null : Date.now() - Math.floor(Math.random() * 30_000),
      latency,
      uptime24h: cfg.baseUptime,
      activeFeeds: cfg.baseFeedCount,
      latencyHistory: buildInitialHistory(source),
    }
  })
}

export function useSourceHealth() {
  const [sources, setSources] = useState<SourceHealthData[]>(buildInitialData)
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    setSources((prev) =>
      prev.map((s) => {
        const cfg = SOURCE_CONFIG[s.source]
        const isFailing = Math.random() < cfg.failChance

        if (isFailing) {
          return {
            ...s,
            status: 'down' as const,
            latency: null,
            activeFeeds: 0,
          }
        }

        const jitter = (Math.random() - 0.5) * cfg.baseLatency * 0.3
        const newLatency = cfg.baseFeedCount === 0 ? null : Math.max(10, cfg.baseLatency + jitter)
        const newUptime = Math.min(
          100,
          Math.max(0, s.uptime24h + (Math.random() - 0.5) * 0.05),
        )
        const newFeeds =
          cfg.baseFeedCount === 0
            ? 0
            : Math.max(0, cfg.baseFeedCount + (Math.random() > 0.9 ? -1 : 0))

        const newHistory: LatencyPoint[] =
          newLatency !== null
            ? [
                ...s.latencyHistory.slice(-(HISTORY_POINTS - 1)),
                { timestamp: Date.now(), latency: newLatency },
              ]
            : s.latencyHistory

        return {
          ...s,
          status: deriveStatus(newLatency, newUptime),
          lastUpdate: newLatency !== null ? Date.now() : s.lastUpdate,
          latency: newLatency,
          uptime24h: newUptime,
          activeFeeds: newFeeds,
          latencyHistory: newHistory,
        }
      }),
    )
    setLastRefreshed(Date.now())
  }, [])

  useEffect(() => {
    timerRef.current = setInterval(refresh, POLL_INTERVAL)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [refresh])

  return { sources, lastRefreshed, refresh }
}
