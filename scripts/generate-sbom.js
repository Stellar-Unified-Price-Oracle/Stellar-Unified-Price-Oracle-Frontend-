#!/usr/bin/env node
/**
 * scripts/generate-sbom.js
 *
 * Generates a CycloneDX 1.4 JSON Software Bill of Materials from
 * package-lock.json.  Output: sbom.json (project root).
 *
 * Does not require any additional npm packages — uses only Node built-ins.
 *
 * Usage:  node scripts/generate-sbom.js [--out path/to/output.json]
 */

import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const LOCKFILE = join(ROOT, 'package-lock.json')
const DEFAULT_OUT = join(ROOT, 'sbom.json')

const outArg = process.argv.indexOf('--out')
const outFile = outArg !== -1 ? process.argv[outArg + 1] : DEFAULT_OUT

const lock = JSON.parse(readFileSync(LOCKFILE, 'utf8'))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

/** Build a purl for an npm package */
function purl(name, version) {
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`
}

/** Derive a deterministic component serial from name+version */
function componentBomRef(name, version) {
  return createHash('sha256').update(`${name}@${version}`).digest('hex').slice(0, 16)
}

const components = []
const packages = lock.packages || {}

for (const [path, info] of Object.entries(packages)) {
  // Skip the root package entry (empty string key)
  if (!path || path === '') continue
  // path is like "node_modules/foo" or "node_modules/foo/node_modules/bar"
  const name = path.replace(/^(node_modules\/)+/, '')
  const version = info.version || '0.0.0'

  const hashes = []
  if (info.integrity) {
    // integrity is like "sha512-<base64>" or "sha1-<base64>"
    const [algo, b64] = info.integrity.split('-')
    const algUpper = algo.toUpperCase().replace('SHA', 'SHA-')
    hashes.push({ alg: algUpper, content: b64 })
  }

  components.push({
    type: 'library',
    'bom-ref': componentBomRef(name, version),
    name,
    version,
    purl: purl(name, version),
    ...(hashes.length ? { hashes } : {}),
    ...(info.resolved ? { externalReferences: [{ type: 'distribution', url: info.resolved }] } : {}),
  })
}

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.4',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: 'stellar-oracle', name: 'generate-sbom.js', version: '1.0.0' }],
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version,
    },
  },
  components,
}

writeFileSync(outFile, JSON.stringify(sbom, null, 2) + '\n')
console.log(`✓ SBOM written to ${outFile} (${components.length} components).`)
