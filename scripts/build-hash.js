#!/usr/bin/env node
/**
 * scripts/build-hash.js
 *
 * Computes a deterministic SHA-256 hash of every file in dist/ and writes
 * dist/build-manifest.json  – a sorted map of { relativePath -> sha256hex }.
 *
 * Usage:
 *   node scripts/build-hash.js           # hash current dist/
 *   node scripts/build-hash.js --verify  # compare against existing manifest
 *
 * For reproducible builds, callers should set SOURCE_DATE_EPOCH before
 * running `npm run build` so that Vite's chunk fingerprints are stable.
 * This script itself is pure-content-hash and is always stable.
 */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = new URL('../dist', import.meta.url).pathname
const MANIFEST = join(DIST, 'build-manifest.json')
const EXCLUDE = new Set(['build-manifest.json'])

/** Recursively collect files under dir, sorted for determinism. */
function collectFiles(dir) {
  const results = []
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full))
    } else {
      results.push(full)
    }
  }
  return results
}

function sha256(filepath) {
  return createHash('sha256').update(readFileSync(filepath)).digest('hex')
}

function buildManifest() {
  const files = collectFiles(DIST)
  const entries = {}
  for (const f of files) {
    const rel = relative(DIST, f)
    if (EXCLUDE.has(rel)) continue
    entries[rel] = sha256(f)
  }
  return entries
}

const verify = process.argv.includes('--verify')

if (!existsSync(DIST)) {
  console.error('dist/ directory not found. Run `npm run build` first.')
  process.exit(1)
}

const current = buildManifest()

if (verify) {
  if (!existsSync(MANIFEST)) {
    console.error('build-manifest.json not found. Run without --verify first.')
    process.exit(1)
  }
  const expected = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const currentKeys = Object.keys(current).sort()
  const expectedKeys = Object.keys(expected).sort()

  let ok = true

  // Check for missing / extra files
  const added = currentKeys.filter((k) => !expected[k])
  const removed = expectedKeys.filter((k) => !current[k])
  if (added.length) { console.error('Added files:', added); ok = false }
  if (removed.length) { console.error('Removed files:', removed); ok = false }

  // Check hash mismatches
  for (const k of currentKeys) {
    if (expected[k] && expected[k] !== current[k]) {
      console.error(`Hash mismatch: ${k}\n  expected ${expected[k]}\n  got      ${current[k]}`)
      ok = false
    }
  }

  if (ok) {
    console.log('✓ Build verified — all hashes match.')
  } else {
    process.exit(1)
  }
} else {
  writeFileSync(MANIFEST, JSON.stringify(current, null, 2) + '\n')
  const count = Object.keys(current).length
  console.log(`✓ build-manifest.json written (${count} files).`)
}
