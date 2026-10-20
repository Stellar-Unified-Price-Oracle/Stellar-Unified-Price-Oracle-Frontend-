/**
 * Release manifest shared by the production build and the service worker (#828).
 *
 * The build writes `release-manifest.json` next to `sw.js` and stamps the
 * release version into `sw.js`. The version is derived from the emitted asset
 * list, so the service worker's cache name changes exactly when the shipped
 * files change, and caches from older releases are pruned on activation.
 *
 * Imported by `vite.config.ts` at build time; the service worker itself is
 * plain JavaScript and does not import this module.
 */
import { z } from 'zod'

export const RELEASE_MANIFEST_FILE = 'release-manifest.json'

export const releaseManifestSchema = z.object({
  buildId: z.string().min(1),
  releaseVersion: z.string().regex(/^[0-9a-f]{8}$/),
  assets: z.array(z.string().min(1)),
})

export type ReleaseManifest = z.infer<typeof releaseManifestSchema>

/** Returns the parsed manifest, or `null` when the payload is not a valid release manifest. */
export function parseReleaseManifest(raw: unknown): ReleaseManifest | null {
  const result = releaseManifestSchema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Deterministic 8-hex-digit release version (FNV-1a over the build ID and the
 * sorted asset list). Stable for identical output; changes when any asset is
 * added, removed, or renamed, or when the build ID changes.
 */
export function computeReleaseVersion(buildId: string, assets: readonly string[]): string {
  const input = `${buildId}\n${[...assets].sort().join('\n')}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
