/**
 * Version Reporting Utilities
 *
 * Provides version information and environment details for monitoring,
 * debugging, and production support.
 *
 * Usage:
 * ```typescript
 * import { getVersionInfo, getAppVersion } from './utils/version'
 *
 * // Get current version
 * const version = getAppVersion()
 *
 * // Get full version info with environment
 * const info = getVersionInfo()
 * console.log(info)
 * ```
 */

/**
 * Version information interface
 */
export interface VersionInfo {
  /** Application version (e.g., "1.2.3") */
  version: string
  /** Git commit SHA (short form) */
  commit: string
  /** Build timestamp (ISO 8601) */
  buildTime: string
  /** Build environment (development, staging, production) */
  environment: string
  /** Node version used for build */
  nodeVersion: string
  /** Git branch the build came from */
  branch: string
  /** Whether this is a pre-release version */
  prerelease: boolean
  /** Whether this is a development build */
  isDev: boolean
  /** Whether this is a production build */
  isProd: boolean
}

/**
 * Build-time version information (injected during build)
 * These values are replaced by the build system
 */
export const BUILD_INFO = {
  VERSION: '__BUILD_VERSION__',
  COMMIT: '__BUILD_COMMIT__',
  BUILD_TIME: '__BUILD_TIME__',
  BRANCH: '__BUILD_BRANCH__',
}

/**
 * Get the current application version
 * @returns Version string (e.g., "1.2.3" or "1.2.3-alpha.1")
 */
export function getAppVersion(): string {
  // Try to get from build-time injection first
  if (BUILD_INFO.VERSION && BUILD_INFO.VERSION !== '__BUILD_VERSION__') {
    return BUILD_INFO.VERSION
  }

  // Fallback to package.json version
  return import.meta.env.VITE_APP_VERSION || '0.0.0'
}

/**
 * Get the build commit SHA
 * @returns Short commit SHA or 'unknown'
 */
export function getBuildCommit(): string {
  if (BUILD_INFO.COMMIT && BUILD_INFO.COMMIT !== '__BUILD_COMMIT__') {
    return BUILD_INFO.COMMIT
  }
  return import.meta.env.VITE_BUILD_COMMIT || 'unknown'
}

/**
 * Get the build timestamp
 * @returns ISO 8601 timestamp or current time
 */
export function getBuildTime(): string {
  if (BUILD_INFO.BUILD_TIME && BUILD_INFO.BUILD_TIME !== '__BUILD_TIME__') {
    return BUILD_INFO.BUILD_TIME
  }
  return new Date().toISOString()
}

/**
 * Get the build branch
 * @returns Git branch name
 */
export function getBuildBranch(): string {
  if (BUILD_INFO.BRANCH && BUILD_INFO.BRANCH !== '__BUILD_BRANCH__') {
    return BUILD_INFO.BRANCH
  }
  return import.meta.env.VITE_BUILD_BRANCH || 'unknown'
}

/**
 * Check if version is a pre-release (contains alpha, beta, rc)
 */
export function isPrerelease(version: string): boolean {
  return /-(alpha|beta|rc|pre)(\.\d+)?/i.test(version)
}

/**
 * Get comprehensive version information
 */
export function getVersionInfo(): VersionInfo {
  const version = getAppVersion()
  const isDev = import.meta.env.DEV
  const isProd = import.meta.env.PROD

  return {
    version,
    commit: getBuildCommit(),
    buildTime: getBuildTime(),
    environment: isProd ? 'production' : isDev ? 'development' : 'unknown',
    nodeVersion: __NODE_VERSION__ || 'unknown',
    branch: getBuildBranch(),
    prerelease: isPrerelease(version),
    isDev,
    isProd,
  }
}

/**
 * Format version info as a readable string
 */
export function formatVersionInfo(info: VersionInfo): string {
  return `
Version: ${info.version}${info.prerelease ? ' (prerelease)' : ''}
Commit: ${info.commit}
Built: ${new Date(info.buildTime).toLocaleString()}
Environment: ${info.environment}
Branch: ${info.branch}
Node: ${info.nodeVersion}
  `.trim()
}

/**
 * Get a user-friendly version string
 * Suitable for UI display
 */
export function getUserVersionString(): string {
  const version = getAppVersion()
  const isDev = import.meta.env.DEV

  if (isDev) {
    const commit = getBuildCommit()
    return `${version} (dev, ${commit})`
  }

  if (isPrerelease(version)) {
    const branch = getBuildBranch()
    return `${version} (${branch})`
  }

  return version
}

/**
 * Log version information to console
 * Useful for debugging in browser DevTools
 */
export function logVersionInfo(): void {
  const info = getVersionInfo()
  const formatted = formatVersionInfo(info)

  console.group('🚀 Application Version Info')
  console.log(formatted)
  console.table(info)
  console.groupEnd()
}

/**
 * Store version info in window for debugging
 * Access in DevTools console: window.__VERSION_INFO__
 */
export function exposeVersionInfo(): void {
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>
    w.__VERSION_INFO__ = getVersionInfo()
    w.__FORMAT_VERSION = formatVersionInfo
  }
}

/**
 * Check if app needs update based on version comparison
 * Returns true if remote version is newer than current
 */
export function shouldUpdate(remoteVersion: string, currentVersion?: string): boolean {
  const current = currentVersion || getAppVersion()
  const remote = parseVersion(remoteVersion)
  const curr = parseVersion(current)

  if (remote.major > curr.major) return true
  if (remote.major === curr.major && remote.minor > curr.minor) return true
  if (remote.major === curr.major && remote.minor === curr.minor && remote.patch > curr.patch) return true

  return false
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string
}

function parseVersion(version: string): ParsedVersion {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)(?:-(.+))?/)

  return {
    major: match ? parseInt(match[1], 10) : 0,
    minor: match ? parseInt(match[2], 10) : 0,
    patch: match ? parseInt(match[3], 10) : 0,
    prerelease: match ? match[4] || '' : '',
  }
}

/**
 * Create a version API endpoint for CI/CD or monitoring
 * Returns version info as JSON
 */
export function createVersionEndpoint() {
  return {
    getVersion: () => getAppVersion(),
    getVersionInfo: () => getVersionInfo(),
    getUserVersion: () => getUserVersionString(),
    shouldUpdate: (remoteVersion: string) => shouldUpdate(remoteVersion),
  }
}

// Placeholder for Node version (will be injected by build)
declare const __NODE_VERSION__: string | undefined

// ---------------------------------------------------------------------------
// WebSocket protocol versioning (#472)
// ---------------------------------------------------------------------------

/**
 * The version of the WebSocket protocol this client speaks.
 *
 * Bump this only on a **breaking** change to the wire format (message shapes,
 * field meaning, or handshake). Backward-compatible additions must keep the
 * version stable and be handled via optional fields.
 *
 * ## Handshake
 * On connect the client sends `{ type: 'hello', protocolVersion }`; the server
 * replies `{ type: 'welcome', protocolVersion }` with the version it will serve.
 *
 * ## Downgrade policy
 * - `welcome.protocolVersion === WS_PROTOCOL_VERSION` — fully compatible.
 * - `welcome.protocolVersion < WS_PROTOCOL_VERSION` — the server is older; the
 *   client silently degrades to the server's feature set (fields it doesn't
 *   know are ignored). No error.
 * - `welcome.protocolVersion > WS_PROTOCOL_VERSION` — the server is newer; the
 *   client stays on the safety subset it understands, logs a warning, and flags
 *   an upgrade prompt (`protocolUpgradeRequired` in the realtime diagnostics).
 * - No `welcome` received — the handshake is not supported; fall back to the
 *   legacy unversioned message stream (downgrade path) and continue.
 *
 * Unknown/unparseable `welcome` payloads are ignored gracefully rather than
 * tearing down the connection.
 */
export const WS_PROTOCOL_VERSION = 1

/**
 * Compatibility verdict between this client build and the deployed API.
 * - `compatible`      — same major.minor as this client.
 * - `minor-mismatch`  — same major, different minor (advisory warning).
 * - `incompatible`    — different major (or server reports a breaking change).
 * - `unknown`         — server version could not be determined.
 */
export type VersionCompatibility = 'compatible' | 'minor-mismatch' | 'incompatible' | 'unknown'

/**
 * API version information interface.
 *
 * Fields prefixed with `server`/`client` are derived locally after detection;
 * the rest are reported by the `/api/version` endpoint when present.
 */
export interface ApiVersionInfo {
  /** Server-reported API version (e.g. "1.4.0"), or "" before detection. */
  version: string
  /** Detected server version (alias of `version`, present after detection). */
  serverVersion: string
  /** Version of this client build (from {@link getAppVersion}). */
  clientVersion: string
  /** Compatibility verdict computed from the server/client versions. */
  compatibility: VersionCompatibility
  /** Human-readable explanation surfaced by {@link ApiVersionBanner}. */
  message?: string
  /** Minimum compatible client version (reported by the server). */
  minClientVersion?: string
  /** Maximum compatible client version (reported by the server). */
  maxClientVersion?: string
  breaking?: boolean
  deprecated?: boolean
  supportedFeatures?: string[]
}

/**
 * Get API version information from server
 * Cached per session
 */
let cachedApiVersionInfo: ApiVersionInfo | null = null
type ApiVersionListener = (info: ApiVersionInfo | null) => void
const versionListeners = new Set<ApiVersionListener>()

export function subscribeApiVersion(listener: ApiVersionListener): () => void {
  versionListeners.add(listener)
  if (cachedApiVersionInfo) listener(cachedApiVersionInfo)
  return () => versionListeners.delete(listener)
}

export async function initApiVersionDetection(signal?: AbortSignal): Promise<ApiVersionInfo | null> {
  const info = await getApiVersionInfo()
  if (signal?.aborted) return null
  versionListeners.forEach((fn) => fn(info))
  return info
}

export async function getApiVersionInfo(): Promise<ApiVersionInfo | null> {
  if (cachedApiVersionInfo) {
    return cachedApiVersionInfo
  }

  try {
    const response = await fetch('/api/version')
    if (!response.ok) return null

    const raw = (await response.json()) as Record<string, unknown>
    const serverVersion =
      typeof raw.serverVersion === 'string' ? raw.serverVersion : typeof raw.version === 'string' ? raw.version : ''

    const base: ApiVersionInfo = {
      version: serverVersion,
      serverVersion,
      clientVersion: getAppVersion(),
      compatibility: 'unknown',
      minClientVersion: typeof raw.minClientVersion === 'string' ? raw.minClientVersion : undefined,
      maxClientVersion: typeof raw.maxClientVersion === 'string' ? raw.maxClientVersion : undefined,
      breaking: typeof raw.breaking === 'boolean' ? raw.breaking : undefined,
      deprecated: typeof raw.deprecated === 'boolean' ? raw.deprecated : undefined,
      supportedFeatures: Array.isArray(raw.supportedFeatures)
        ? raw.supportedFeatures.filter((f): f is string => typeof f === 'string')
        : undefined,
    }

    cachedApiVersionInfo = {
      ...base,
      ...classifyApiVersion(base),
    }
    return cachedApiVersionInfo
  } catch {
    // API version endpoint not available or failed
    return null
  }
}

/**
 * Derive the banner-facing fields (`compatibility`, `message`) from a base
 * {@link ApiVersionInfo}. Mirrors the logic of `scripts/check-api-version.js`:
 * same major.minor → compatible; same major, different minor → minor-mismatch;
 * different major (or a server-reported `breaking` flag) → incompatible.
 */
function classifyApiVersion(
  base: Pick<ApiVersionInfo, 'version' | 'clientVersion' | 'breaking' | 'deprecated'>,
): Pick<ApiVersionInfo, 'compatibility' | 'message'> {
  if (base.breaking) {
    return {
      compatibility: 'incompatible',
      message: 'The API has announced a breaking change. This version of the dashboard may stop working.',
    }
  }

  const server = parseMajorMinor(base.version)
  const client = parseMajorMinor(base.clientVersion)
  if (!server || !client) {
    return { compatibility: 'unknown', message: undefined }
  }

  if (server.major !== client.major) {
    return {
      compatibility: 'incompatible',
      message: `This dashboard (v${client.major}.${client.minor}) is incompatible with the deployed API (v${server.major}.${server.minor}). Please update the frontend.`,
    }
  }

  if (server.minor !== client.minor) {
    return {
      compatibility: 'minor-mismatch',
      message: base.deprecated
        ? 'The API version in use is deprecated and may be removed in a future release.'
        : `The deployed API (v${server.major}.${server.minor}) differs from this client's expected version (v${client.major}.${client.minor}).`,
    }
  }

  return { compatibility: 'compatible', message: undefined }
}

function parseMajorMinor(version: string): { major: number; minor: number } | null {
  const parts = version.trim().split('.')
  const major = Number.parseInt(parts[0] ?? '', 10)
  const minor = parts[1] !== undefined ? Number.parseInt(parts[1], 10) : 0
  return Number.isNaN(major) || Number.isNaN(minor) ? null : { major, minor }
}

/**
 * Get Accept header value for API versioning.
 * Used in REST requests to request a specific API version.
 *
 * When the server's version is already known (from `/api/version`) it is
 * echoed back so the request is served by the handler version the client has
 * already negotiated; otherwise the client advertises its own build version.
 */
export function getAcceptVersionHeader(serverVersion?: string | null): string {
  const version = serverVersion || getAppVersion()
  return `application/vnd.stellar+json;version=${version}`
}

/**
 * Check if client version is compatible with API version
 */
export function isCompatibleWithApi(clientVersion: string, apiInfo: ApiVersionInfo): boolean {
  if (!apiInfo.minClientVersion && !apiInfo.maxClientVersion) {
    return true
  }

  const clientParts = parseVersionStrict(clientVersion)
  const minParts = apiInfo.minClientVersion ? parseVersionStrict(apiInfo.minClientVersion) : null
  const maxParts = apiInfo.maxClientVersion ? parseVersionStrict(apiInfo.maxClientVersion) : null

  if (minParts && compareVersionParts(clientParts, minParts) < 0) {
    return false
  }

  if (maxParts && compareVersionParts(clientParts, maxParts) > 0) {
    return false
  }

  return true
}

interface VersionParts {
  major: number
  minor: number
  patch: number
}

function parseVersionStrict(version: string): VersionParts {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/)
  return {
    major: match ? parseInt(match[1], 10) : 0,
    minor: match ? parseInt(match[2], 10) : 0,
    patch: match ? parseInt(match[3], 10) : 0,
  }
}

function compareVersionParts(a: VersionParts, b: VersionParts): number {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1
  return 0
}
