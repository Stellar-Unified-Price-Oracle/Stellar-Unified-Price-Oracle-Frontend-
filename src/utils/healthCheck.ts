/**
 * Health Check System
 *
 * Provides comprehensive health checks for monitoring application status,
 * dependencies, and performance. Used by monitoring systems and load balancers.
 *
 * Endpoints:
 * - GET /health - Basic health status
 * - GET /health/detailed - Full diagnostics
 * - GET /health/live - Kubernetes liveness probe
 * - GET /health/ready - Kubernetes readiness probe
 */

import { getVersionInfo } from '../api/version'

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface HealthCheckResult {
  status: HealthStatus
  timestamp: string
  uptime: number
  version: string
  environment: string
  checks: {
    [key: string]: {
      status: HealthStatus
      latency?: number
      error?: string
      lastChecked?: string
    }
  }
  metrics?: {
    memoryUsage?: number
    cpuUsage?: number
    errorRate?: number
    responseTime?: number
  }
}

const startTime = performance.now()
const checkResults: Map<string, { status: HealthStatus; latency: number; error?: string }> = new Map()

/**
 * Check if WebSocket connection is available
 */
export async function checkWebSocket(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
  const start = performance.now()

  try {
    // Try to establish WebSocket connection (will be rejected if not available)
    const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3000')

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.close()
        resolve({
          status: 'unhealthy',
          latency: performance.now() - start,
          error: 'WebSocket connection timeout',
        })
      }, 3000)

      ws.onopen = () => {
        clearTimeout(timeout)
        ws.close()
        resolve({
          status: 'healthy',
          latency: performance.now() - start,
        })
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        resolve({
          status: 'unhealthy',
          latency: performance.now() - start,
          error: 'WebSocket connection failed',
        })
      }
    })
  } catch (_error) {
    return {
      status: 'unhealthy',
      latency: performance.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if REST API is available
 */
export async function checkRestApi(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
  const start = performance.now()

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    const latency = performance.now() - start

    if (response.ok) {
      return { status: 'healthy', latency }
    }

    return {
      status: response.status >= 500 ? 'unhealthy' : 'degraded',
      latency,
      error: `HTTP ${response.status}`,
    }
  } catch (_error) {
    return {
      status: 'unhealthy',
      latency: performance.now() - start,
      error: error instanceof Error ? error.message : 'Request failed',
    }
  }
}

/**
 * Check IndexedDB availability
 */
export async function checkIndexedDB(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
  const start = performance.now()

  try {
    if (!('indexedDB' in window)) {
      return {
        status: 'unhealthy',
        latency: performance.now() - start,
        error: 'IndexedDB not available',
      }
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('health-check-test')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      setTimeout(() => reject(new Error('Timeout')), 3000)
    })

    db.close()

    return {
      status: 'healthy',
      latency: performance.now() - start,
    }
  } catch (_error) {
    return {
      status: 'degraded',
      latency: performance.now() - start,
      error: error instanceof Error ? error.message : 'IndexedDB check failed',
    }
  }
}

/**
 * Check localStorage availability
 */
export async function checkLocalStorage(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
  const start = performance.now()

  try {
    const testKey = '__health_check__'
    localStorage.setItem(testKey, 'ok')
    const value = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)

    if (value === 'ok') {
      return {
        status: 'healthy',
        latency: performance.now() - start,
      }
    }

    return {
      status: 'degraded',
      latency: performance.now() - start,
      error: 'localStorage read/write failed',
    }
  } catch (_error) {
    return {
      status: 'degraded',
      latency: performance.now() - start,
      error: error instanceof Error ? error.message : 'localStorage unavailable',
    }
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString()
  const uptime = performance.now() - startTime

  try {
    const [wsCheck, apiCheck, idbCheck, storageCheck] = await Promise.all([
      checkWebSocket(),
      checkRestApi(),
      checkIndexedDB(),
      checkLocalStorage(),
    ])

    // Update cache
    checkResults.set('websocket', wsCheck)
    checkResults.set('rest-api', apiCheck)
    checkResults.set('indexeddb', idbCheck)
    checkResults.set('localstorage', storageCheck)
    lastCheckTime = Date.now()

    // Determine overall status
    const statuses = [wsCheck.status, apiCheck.status, idbCheck.status, storageCheck.status]
    const hasUnhealthy = statuses.includes('unhealthy')
    const hasDegraded = statuses.includes('degraded')

    const overallStatus: HealthStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy'

    const versionInfo = getVersionInfo()

    return {
      status: overallStatus,
      timestamp,
      uptime,
      version: versionInfo.version,
      environment: versionInfo.environment,
      checks: {
        websocket: wsCheck,
        'rest-api': apiCheck,
        indexeddb: idbCheck,
        localstorage: storageCheck,
      },
    }
  } catch (_error) {
    return {
      status: 'unhealthy',
      timestamp,
      uptime,
      version: getVersionInfo().version,
      environment: getVersionInfo().environment,
      checks: {},
      metrics: undefined,
    }
  }
}

/**
 * Get cached health check result
 */
export function getHealthStatus(): HealthCheckResult | null {
  if (checkResults.size === 0) {
    return null
  }

  const versionInfo = getVersionInfo()
  const checks: HealthCheckResult['checks'] = {}

  checkResults.forEach((result, name) => {
    checks[name] = result
  })

  const statuses = Array.from(checkResults.values()).map((r) => r.status)
  const hasUnhealthy = statuses.includes('unhealthy')
  const hasDegraded = statuses.includes('degraded')

  return {
    status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    uptime: performance.now() - startTime,
    version: versionInfo.version,
    environment: versionInfo.environment,
    checks,
  }
}

/**
 * Initialize health check monitoring
 * Runs checks periodically and exposes them for monitoring systems
 */
export function initHealthCheckMonitoring(intervalMs: number = 60000): () => void {
  // Initial check
  runHealthChecks().catch(() => {})

  // Schedule periodic checks
  const interval = setInterval(() => {
    runHealthChecks().catch(() => {})
  }, intervalMs)

  // Expose health endpoint in window for debugging
  if (typeof window !== 'undefined') {
    (window as any).__HEALTH_CHECK__ = {
      getStatus: getHealthStatus,
      runNow: runHealthChecks,
      checks: {
        websocket: checkWebSocket,
        restApi: checkRestApi,
        indexeddb: checkIndexedDB,
        localStorage: checkLocalStorage,
      },
    }
  }

  // Return cleanup function
  return () => clearInterval(interval)
}

/**
 * Express/Fastify middleware for health check endpoints
 */
export function createHealthCheckEndpoints() {
  return {
    /**
     * GET /health
     * Basic liveness check - used by load balancers
     */
    getHealth: async () => {
      const health = await runHealthChecks()
      return {
        status: health.status,
        timestamp: health.timestamp,
      }
    },

    /**
     * GET /health/detailed
     * Full health report with all checks
     */
    getHealthDetailed: async () => {
      return await runHealthChecks()
    },

    /**
     * GET /health/live
     * Kubernetes liveness probe - returns 200 if process is alive
     */
    getLive: async () => {
      return { alive: true }
    },

    /**
     * GET /health/ready
     * Kubernetes readiness probe - returns 200 if ready to serve traffic
     */
    getReady: async () => {
      const health = await runHealthChecks()
      return {
        ready: health.status !== 'unhealthy',
        checks: health.checks,
      }
    },
  }
}

/**
 * Health check middleware for monitoring
 */
export function healthCheckMiddleware() {
  return async (req: any, res: any, next: any) => {
    if (req.path === '/health') {
      const endpoints = createHealthCheckEndpoints()
      const health = await endpoints.getHealth()
      return res.status(200).json(health)
    }

    if (req.path === '/health/detailed') {
      const endpoints = createHealthCheckEndpoints()
      const health = await endpoints.getHealthDetailed()
      return res.status(health.status === 'unhealthy' ? 503 : 200).json(health)
    }

    if (req.path === '/health/live') {
      const endpoints = createHealthCheckEndpoints()
      return res.status(200).json(await endpoints.getLive())
    }

    if (req.path === '/health/ready') {
      const endpoints = createHealthCheckEndpoints()
      const ready = await endpoints.getReady()
      return res.status(ready.ready ? 200 : 503).json(ready)
    }

    next()
  }
}
