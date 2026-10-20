import { describe, expect, it } from 'vitest'
import { computeReleaseVersion, parseReleaseManifest } from './releaseManifest'

describe('parseReleaseManifest', () => {
  it('accepts a well-formed manifest', () => {
    const manifest = { buildId: 'abc123', releaseVersion: '0a1b2c3d', assets: ['index.html', 'assets/app.js'] }
    expect(parseReleaseManifest(manifest)).toEqual(manifest)
  })

  it('rejects a manifest whose release version is not 8 lowercase hex digits', () => {
    expect(parseReleaseManifest({ buildId: 'x', releaseVersion: 'ZZZ', assets: [] })).toBeNull()
  })

  it('rejects non-object payloads', () => {
    expect(parseReleaseManifest(null)).toBeNull()
    expect(parseReleaseManifest('index.html')).toBeNull()
  })
})

describe('computeReleaseVersion', () => {
  it('returns 8 lowercase hex digits', () => {
    expect(computeReleaseVersion('build-1', ['index.html'])).toMatch(/^[0-9a-f]{8}$/)
  })

  it('does not depend on asset order', () => {
    expect(computeReleaseVersion('b', ['a.js', 'b.css'])).toBe(computeReleaseVersion('b', ['b.css', 'a.js']))
  })

  it('changes when the build ID changes', () => {
    expect(computeReleaseVersion('build-1', ['a.js'])).not.toBe(computeReleaseVersion('build-2', ['a.js']))
  })

  it('changes when an asset is added or renamed', () => {
    const base = computeReleaseVersion('b', ['a.js'])
    expect(computeReleaseVersion('b', ['a.js', 'c.js'])).not.toBe(base)
    expect(computeReleaseVersion('b', ['renamed.js'])).not.toBe(base)
  })
})
