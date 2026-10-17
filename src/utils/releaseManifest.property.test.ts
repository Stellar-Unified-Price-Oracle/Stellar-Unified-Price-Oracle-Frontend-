import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeReleaseVersion, parseReleaseManifest } from './releaseManifest'

// Asset paths are generated from the filename characters the Vite build emits
// (letters, digits, dashes, dots, slashes), which is the domain the release
// version is computed over.
const assetPath = fc.stringMatching(/^[a-z0-9][a-z0-9/_.-]{0,30}$/)

describe('computeReleaseVersion (properties)', () => {
  it('is always 8 lowercase hex digits', () => {
    fc.assert(
      fc.property(fc.string(), fc.array(assetPath), (buildId, assets) => {
        expect(computeReleaseVersion(buildId, assets)).toMatch(/^[0-9a-f]{8}$/)
      }),
    )
  })

  it('is invariant under reordering of the asset list', () => {
    fc.assert(
      fc.property(fc.string(), fc.uniqueArray(assetPath, { minLength: 2, maxLength: 20 }), (buildId, assets) => {
        const reversed = [...assets].reverse()
        expect(computeReleaseVersion(buildId, reversed)).toBe(computeReleaseVersion(buildId, assets))
      }),
    )
  })
})

describe('parseReleaseManifest (properties)', () => {
  it('round-trips any manifest produced from a computed version', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.array(assetPath), (buildId, assets) => {
        const manifest = { buildId, releaseVersion: computeReleaseVersion(buildId, assets), assets }
        expect(parseReleaseManifest(manifest)).toEqual(manifest)
      }),
    )
  })
})
