#!/usr/bin/env node
/**
 * check-api-version.js
 *
 * CI script that verifies the frontend's declared API version range is
 * compatible with the running backend. Exits non-zero if incompatible.
 *
 * Usage:
 *   node scripts/check-api-version.js [--api-url <url>]
 *
 * Environment variables:
 *   VITE_API_URL  — Base URL of the API server (default: http://localhost:3000)
 *
 * The script probes the /api/version endpoint (then /health as fallback)
 * and checks the X-API-Version response header or JSON body.
 *
 * Exit codes:
 *   0 — compatible or unknown (non-blocking)
 *   1 — incompatible (blocking)
 */

import { parseArgs } from 'node:util'

// ── Inline version constants (mirror of src/api/version.ts) ──────────────────
// These are intentionally duplicated so this script runs without transpilation.
const CURRENT_API_VERSION = '1.0'
const MIN_COMPATIBLE_API_VERSION = '1.0'
const MAX_COMPATIBLE_API_VERSION = '1.99'

function parseMajorMinor(version) {
  const parts = String(version).trim().split('.')
  const major = parseInt(parts[0], 10)
  const minor = parts[1] !== undefined ? parseInt(parts[1], 10) : 0
  if (isNaN(major) || isNaN(minor)) return null
  return [major, minor]
}

function checkCompatibility(serverVersion) {
  const server = parseMajorMinor(serverVersion)
  const min = parseMajorMinor(MIN_COMPATIBLE_API_VERSION)
  const max = parseMajorMinor(MAX_COMPATIBLE_API_VERSION)
  const current = parseMajorMinor(CURRENT_API_VERSION)

  if (!server || !min || !max || !current) return 'unknown'

  const [sMajor, sMinor] = server
  const [minMajor] = min
  const [maxMajor] = max
  const [, currentMinor] = current

  if (sMajor < minMajor || sMajor > maxMajor) return 'incompatible'
  if (sMinor !== currentMinor) return 'minor-mismatch'
  return 'compatible'
}

// ── CLI args ─────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    'api-url': { type: 'string', short: 'u' },
    'skip-on-unavailable': { type: 'boolean', default: true },
  },
  allowPositionals: false,
})

const apiUrl = values['api-url'] || process.env.VITE_API_URL || 'http://localhost:3000'
const skipOnUnavailable = values['skip-on-unavailable'] !== false

// ── Probe helper ─────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, opts = {}, timeoutMs = 10_000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

async function detectServerVersion(base) {
  const headers = {
    'Accept': 'application/json',
    'Accept-Version': CURRENT_API_VERSION,
  }

  // 1. /api/version endpoint
  try {
    const res = await fetchWithTimeout(`${base}/api/version`, { headers })
    if (res.ok) {
      const header = res.headers.get('X-API-Version')
      if (header) return header
      const json = await res.json().catch(() => null)
      if (json?.version) return String(json.version)
      if (json?.apiVersion) return String(json.apiVersion)
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn(`[api-version-check] Timeout reaching ${base}/api/version`)
    }
  }

  // 2. /health fallback
  const healthBase = base.replace(/\/api$/, '')
  try {
    const res = await fetchWithTimeout(`${healthBase}/health`, { headers })
    const header = res.headers.get('X-API-Version')
    if (header) return header
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn(`[api-version-check] Timeout reaching ${healthBase}/health`)
    }
  }

  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`[api-version-check] Probing ${apiUrl} …`)
console.log(`[api-version-check] Frontend targets API v${CURRENT_API_VERSION} (supports v${MIN_COMPATIBLE_API_VERSION}–v${MAX_COMPATIBLE_API_VERSION})`)

const serverVersion = await detectServerVersion(apiUrl).catch(() => null)

if (serverVersion === null) {
  if (skipOnUnavailable) {
    console.warn('[api-version-check] ⚠ Could not reach the API server — skipping version check.')
    console.warn('[api-version-check]   Set --no-skip-on-unavailable to make this a hard failure.')
    process.exit(0)
  } else {
    console.error('[api-version-check] ✗ Could not reach the API server and --skip-on-unavailable is false.')
    process.exit(1)
  }
}

const compat = checkCompatibility(serverVersion)

if (compat === 'compatible') {
  console.log(`[api-version-check] ✅ Compatible — server v${serverVersion} matches frontend v${CURRENT_API_VERSION}`)
  process.exit(0)
}

if (compat === 'minor-mismatch') {
  console.warn(`[api-version-check] ⚠ Minor mismatch — server v${serverVersion} vs frontend v${CURRENT_API_VERSION}`)
  console.warn('[api-version-check]   Minor mismatches are usually backwards-compatible. Continuing.')
  process.exit(0)
}

if (compat === 'unknown') {
  console.warn(`[api-version-check] ⚠ Unknown version format "${serverVersion}" — could not determine compatibility.`)
  process.exit(0)
}

// incompatible
console.error(`[api-version-check] ✗ INCOMPATIBLE — server v${serverVersion} is outside the supported range v${MIN_COMPATIBLE_API_VERSION}–v${MAX_COMPATIBLE_API_VERSION}`)
console.error('[api-version-check]   Update the backend or bump MIN/MAX_COMPATIBLE_API_VERSION in src/api/version.ts')
process.exit(1)
