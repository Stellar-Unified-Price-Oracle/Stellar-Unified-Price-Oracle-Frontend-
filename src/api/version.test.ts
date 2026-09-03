import { describe, it, expect } from 'vitest'
import {
  getAppVersion,
  getBuildCommit,
  getBuildTime,
  getBuildBranch,
  getVersionInfo,
  formatVersionInfo,
  getUserVersionString,
  isPrerelease,
  shouldUpdate,
  createVersionEndpoint,
  type VersionInfo,
} from './version'
import {
  versionEndpoints,
  compareVersions,
  createMockVersionEndpoint,
} from './versionEndpoints'

describe('Version Management', () => {
  describe('getAppVersion', () => {
    it('returns a valid version string', () => {
      const version = getAppVersion()
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('always returns a semantic version', () => {
      const version = getAppVersion()
      const parts = version.split('.')
      expect(parts.length).toBeGreaterThanOrEqual(3)
      expect(/^\d+$/.test(parts[0])).toBe(true)
      expect(/^\d+$/.test(parts[1])).toBe(true)
    })
  })

  describe('getBuildCommit', () => {
    it('returns a commit SHA or unknown', () => {
      const commit = getBuildCommit()
      expect(commit).toBeTruthy()
      expect(typeof commit).toBe('string')
    })
  })

  describe('getBuildTime', () => {
    it('returns a valid ISO 8601 timestamp', () => {
      const time = getBuildTime()
      const date = new Date(time)
      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('getBuildBranch', () => {
    it('returns a branch name', () => {
      const branch = getBuildBranch()
      expect(branch).toBeTruthy()
      expect(typeof branch).toBe('string')
    })
  })

  describe('isPrerelease', () => {
    it('identifies prerelease versions', () => {
      expect(isPrerelease('1.0.0')).toBe(false)
      expect(isPrerelease('1.0.0-alpha.1')).toBe(true)
      expect(isPrerelease('1.0.0-beta.1')).toBe(true)
      expect(isPrerelease('1.0.0-rc.1')).toBe(true)
      expect(isPrerelease('2.0.0-pre.1')).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(isPrerelease('1.0.0-ALPHA.1')).toBe(true)
      expect(isPrerelease('1.0.0-Alpha.1')).toBe(true)
    })
  })

  describe('shouldUpdate', () => {
    it('detects major version updates', () => {
      expect(shouldUpdate('2.0.0', '1.0.0')).toBe(true)
      expect(shouldUpdate('1.0.0', '2.0.0')).toBe(false)
    })

    it('detects minor version updates', () => {
      expect(shouldUpdate('1.1.0', '1.0.0')).toBe(true)
      expect(shouldUpdate('1.0.0', '1.1.0')).toBe(false)
    })

    it('detects patch version updates', () => {
      expect(shouldUpdate('1.0.1', '1.0.0')).toBe(true)
      expect(shouldUpdate('1.0.0', '1.0.1')).toBe(false)
    })

    it('returns false for equal versions', () => {
      expect(shouldUpdate('1.0.0', '1.0.0')).toBe(false)
    })

    it('ignores prerelease versions', () => {
      expect(shouldUpdate('1.0.0', '1.0.0-rc.1')).toBe(false)
      expect(shouldUpdate('1.0.0-rc.1', '1.0.0-rc.2')).toBe(false)
    })

    it('uses current version as default', () => {
      const current = getAppVersion()
      // This should not throw
      shouldUpdate('99.0.0')
    })
  })

  describe('getVersionInfo', () => {
    it('returns complete version information', () => {
      const info = getVersionInfo()

      expect(info.version).toBeTruthy()
      expect(info.commit).toBeTruthy()
      expect(info.buildTime).toBeTruthy()
      expect(info.environment).toBeTruthy()
      expect(info.branch).toBeTruthy()
      expect(typeof info.prerelease).toBe('boolean')
      expect(typeof info.isDev).toBe('boolean')
      expect(typeof info.isProd).toBe('boolean')
    })

    it('environment matches isDev and isProd', () => {
      const info = getVersionInfo()

      if (import.meta.env.DEV) {
        expect(info.isDev).toBe(true)
        expect(info.environment).toBe('development')
      }

      if (import.meta.env.PROD) {
        expect(info.isProd).toBe(true)
        expect(info.environment).toBe('production')
      }
    })

    it('prerelease matches version pattern', () => {
      const info = getVersionInfo()
      const shouldBePrerelease = isPrerelease(info.version)
      expect(info.prerelease).toBe(shouldBePrerelease)
    })
  })

  describe('formatVersionInfo', () => {
    it('returns a formatted string', () => {
      const info = getVersionInfo()
      const formatted = formatVersionInfo(info)

      expect(formatted).toContain('Version:')
      expect(formatted).toContain('Commit:')
      expect(formatted).toContain('Built:')
      expect(formatted).toContain('Environment:')
      expect(formatted).toContain('Branch:')
    })

    it('includes prerelease tag when applicable', () => {
      const info: VersionInfo = {
        version: '1.0.0-rc.1',
        commit: 'abc123',
        buildTime: new Date().toISOString(),
        environment: 'staging',
        nodeVersion: '22.0.0',
        branch: 'staging',
        prerelease: true,
        isDev: false,
        isProd: false,
      }

      const formatted = formatVersionInfo(info)
      expect(formatted).toContain('(prerelease)')
    })
  })

  describe('getUserVersionString', () => {
    it('returns a user-friendly version', () => {
      const version = getUserVersionString()
      expect(version).toBeTruthy()
      expect(typeof version).toBe('string')
    })

    it('includes dev indicator in development', () => {
      if (import.meta.env.DEV) {
        const version = getUserVersionString()
        expect(version).toContain('dev')
      }
    })

    it('includes branch info for prerelease', () => {
      const info = getVersionInfo()
      if (info.prerelease) {
        const version = getUserVersionString()
        expect(version).toContain(info.branch)
      }
    })
  })

  describe('createVersionEndpoint', () => {
    it('returns version endpoint object', () => {
      const endpoint = createVersionEndpoint()

      expect(endpoint).toHaveProperty('getVersion')
      expect(endpoint).toHaveProperty('getVersionInfo')
      expect(endpoint).toHaveProperty('getUserVersion')
      expect(endpoint).toHaveProperty('shouldUpdate')
    })

    it('provides working version methods', () => {
      const endpoint = createVersionEndpoint()

      expect(endpoint.getVersion()).toBeTruthy()
      expect(endpoint.getVersionInfo()).toHaveProperty('version')
      expect(endpoint.getUserVersion()).toBeTruthy()
      expect(endpoint.shouldUpdate('99.0.0')).toBe(true)
    })
  })
})

describe('Version Endpoints', () => {
  describe('compareVersions', () => {
    it('identifies greater versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    })

    it('identifies lesser versions', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    })

    it('identifies equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('2.3.4', '2.3.4')).toBe(0)
    })

    it('handles partial version numbers', () => {
      expect(compareVersions('1.2', '1.2.0')).toBe(0)
      expect(compareVersions('1', '1.0.0')).toBe(0)
    })
  })

  describe('versionEndpoints.getVersion', () => {
    it('returns version response', () => {
      const response = versionEndpoints.getVersion()

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('version')
      expect(response.data).toHaveProperty('userVersion')
      expect(response.data).toHaveProperty('fullInfo')
      expect(response.data).toHaveProperty('formatted')
      expect(response.timestamp).toBeTruthy()
    })

    it('timestamp is valid ISO 8601', () => {
      const response = versionEndpoints.getVersion()
      const date = new Date(response.timestamp)
      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('versionEndpoints.getHealthVersion', () => {
    it('returns health check format', () => {
      const response = versionEndpoints.getHealthVersion()

      expect(response).toHaveProperty('status')
      expect(response).toHaveProperty('version')
      expect(response).toHaveProperty('commit')
      expect(response).toHaveProperty('timestamp')
      expect(response).toHaveProperty('environment')
    })

    it('status is always ok', () => {
      const response = versionEndpoints.getHealthVersion()
      expect(response.status).toBe('ok')
    })
  })

  describe('versionEndpoints.checkUpdate', () => {
    it('detects updates needed', () => {
      const response = versionEndpoints.checkUpdate('99.0.0')

      expect(response).toHaveProperty('current')
      expect(response).toHaveProperty('remote')
      expect(response.needsUpdate).toBe(true)
      expect(response.message).toContain('Update available')
    })

    it('detects when no update needed', () => {
      const current = getAppVersion()
      const response = versionEndpoints.checkUpdate(current)

      expect(response.needsUpdate).toBe(false)
      expect(response.message).toContain('up to date')
    })
  })

  describe('createMockVersionEndpoint', () => {
    it('creates mock version endpoint', () => {
      const endpoint = createMockVersionEndpoint('1.2.3')

      expect(endpoint).toHaveProperty('getVersion')
      expect(endpoint).toHaveProperty('checkUpdate')
    })

    it('returns mock version', () => {
      const endpoint = createMockVersionEndpoint('1.2.3')
      const response = endpoint.getVersion()

      expect(response.data.version).toBe('1.2.3')
    })

    it('mock endpoint handles updates', () => {
      const endpoint = createMockVersionEndpoint('1.0.0')
      const response = endpoint.checkUpdate("1.1.0")

      expect(response.remote).toBe('1.1.0')
      expect(response.needsUpdate).toBe(true)
    })
  })
})

describe('Version Integration', () => {
  it('version info is consistent', () => {
    const version = getAppVersion()
    const info = getVersionInfo()

    expect(info.version).toBe(version)
  })

  it('prerelease state is consistent', () => {
    const version = getAppVersion()
    const info = getVersionInfo()

    expect(info.prerelease).toBe(isPrerelease(version))
  })

  it('version string formats correctly', () => {
    const version = getAppVersion()
    expect(/^\d+\.\d+\.\d+/.test(version)).toBe(true)
  })

  it('version comparison is transitive', () => {
    // If a > b and b > c, then a > c
    expect(compareVersions('3.0.0', '2.0.0')).toBe(1)
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
    expect(compareVersions('3.0.0', '1.0.0')).toBe(1)
  })

  it('shouldUpdate uses compareVersions correctly', () => {
    const v1 = '2.0.0'
    const v2 = '1.0.0'

    const comparison = compareVersions(v1, v2)
    const shouldUpdateResult = shouldUpdate(v1, v2)

    expect(shouldUpdateResult).toBe(comparison > 0)
  })
})
