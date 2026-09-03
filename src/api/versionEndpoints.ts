/**
 * Version API Endpoints
 *
 * Provides version information endpoints that can be queried by CI/CD,
 * monitoring systems, and UI components.
 */

import { getVersionInfo, getUserVersionString, getAppVersion, formatVersionInfo } from './version'

export interface VersionResponse {
  success: boolean
  data: {
    version: string
    userVersion: string
    fullInfo: ReturnType<typeof getVersionInfo>
    formatted: string
  }
  timestamp: string
}

/**
 * Create version endpoint handlers
 * Can be used with Express, Fastify, or other frameworks
 */
export const versionEndpoints = {
  /**
   * GET /api/version
   * Returns current application version
   */
  getVersion: (): VersionResponse => {
    return {
      success: true,
      data: {
        version: getAppVersion(),
        userVersion: getUserVersionString(),
        fullInfo: getVersionInfo(),
        formatted: formatVersionInfo(getVersionInfo()),
      },
      timestamp: new Date().toISOString(),
    }
  },

  /**
   * GET /health/version
   * Returns version info for health check systems
   */
  getHealthVersion: () => {
    const info = getVersionInfo()
    return {
      status: 'ok',
      version: info.version,
      commit: info.commit,
      timestamp: info.buildTime,
      environment: info.environment,
    }
  },

  /**
   * GET /api/version/check?remote=1.2.3
   * Check if update is needed
   */
  checkUpdate: (remoteVersion: string) => {
    const current = getAppVersion()
    const needsUpdate = compareVersions(remoteVersion, current) > 0

    return {
      current,
      remote: remoteVersion,
      needsUpdate,
      message: needsUpdate ? `Update available: ${remoteVersion}` : 'You are up to date',
    }
  },
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parse = (v: string) => {
    const parts = v.split('.')
    return {
      major: parseInt(parts[0] || '0', 10),
      minor: parseInt(parts[1] || '0', 10),
      patch: parseInt(parts[2] || '0', 10),
    }
  }

  const p1 = parse(v1)
  const p2 = parse(v2)

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1

  return 0
}

/**
 * Mock version endpoint for testing
 * Use this to test version checking without a backend
 */
export function createMockVersionEndpoint(mockVersion: string = '1.0.0') {
  return {
    getVersion: () => ({
      success: true,
      data: {
        version: mockVersion,
        userVersion: mockVersion,
        fullInfo: getVersionInfo(),
        formatted: formatVersionInfo(getVersionInfo()),
      },
      timestamp: new Date().toISOString(),
    }),

    checkUpdate: (remoteVersion: string) => ({
      current: mockVersion,
      remote: remoteVersion,
      needsUpdate: compareVersions(remoteVersion, mockVersion) > 0,
    }),
  }
}
