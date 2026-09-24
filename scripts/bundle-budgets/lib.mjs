/**
 * Pure library for the structural bundle budget guard.
 *
 * Enforces three invariants a glob-based size-limit config cannot express:
 *
 *  1. Coverage — every emitted JS/CSS file must be classified (initial,
 *     vendor, or claimed by a declared lazy route). No chunk escapes the
 *     budget system by simply not matching a glob.
 *  2. Initial-load boundary — the initial download is entry chunk(s) plus
 *     statically reachable vendor chunks ONLY. The set of lazily imported
 *     route entries is pinned by an explicit allowlist, so moving code into
 *     a `lazy()` chunk that still loads on every visit requires a reviewable
 *     config change. Undeclared dynamic imports fail the build.
 *  3. Vendor attribution — each named vendor chunk has a size budget AND an
 *     exact allowlist of npm packages, verified from the build's
 *     chunk-to-module map. Vendoring a heavy dep into the "react" chunk
 *     fails with the package named.
 *
 * All functions are pure so they can be unit-tested with synthetic manifests.
 * Sizes are brotli, matching `npm run size-limit`.
 */

import { brotliCompressSync, constants as zlibConstants } from 'node:zlib'

const JS_RE = /\.js$/i
const CSS_RE = /\.css$/i
const SEP_RE = /[\\/]/g

export function isJs(file) {
  return JS_RE.test(file)
}

export function isCss(file) {
  return CSS_RE.test(file)
}

/**
 * Extract the npm package name from an absolute Rollup module id.
 * Handles the project root prefix, pnpm-style `.pnpm` store paths, and
 * Vite query suffixes like `?commonjs-exports`. Returns null for app code.
 */
export function extractPackageName(moduleId, root = process.cwd()) {
  const rootPrefix = root.endsWith('/') ? root : `${root}/`
  let rest = moduleId.startsWith(rootPrefix) ? moduleId.slice(rootPrefix.length) : moduleId
  rest = rest.split('?')[0].replace(SEP_RE, '/')
  const marker = 'node_modules/'
  const idx = rest.lastIndexOf(marker)
  if (idx === -1) return null
  let after = rest.slice(idx + marker.length)
  while (after.startsWith('.pnpm/')) {
    const next = after.indexOf(marker)
    if (next === -1) return null
    after = after.slice(next + marker.length)
  }
  const segs = after.split('/')
  if (segs.length === 0 || segs[0] === '') return null
  if (segs[0].startsWith('@')) {
    return segs.length >= 2 && segs[1] !== '' ? `${segs[0]}/${segs[1]}` : null
  }
  return segs[0]
}

export function packageAllowlistViolation(packageName, allowlist) {
  if (!allowlist.includes(packageName)) {
    return `package "${packageName}" is not in the chunk's package allowlist`
  }
  return null
}

/**
 * Classify every JS chunk from the Vite manifest and verify the structural
 * invariants. Throws Error on any structural violation.
 */
export function classifyChunks(manifest, config, root = process.cwd()) {
  const chunkModules = config.__chunkModules ?? {}
  const vendorConfig = config.vendorChunks ?? {}
  const lazyRoutesConfig = config.lazyRoutes ?? {}
  const vendorNames = new Set(Object.keys(vendorConfig))

  // --- Entry -----------------------------------------------------------------
  const entryKeys = Object.keys(manifest).filter((k) => manifest[k].isEntry)
  if (entryKeys.length === 0) {
    throw new Error(
      'No entry chunk found in the build manifest (no isEntry) — the initial-load boundary cannot be established.',
    )
  }
  if (entryKeys.length > 1) {
    throw new Error(
      `Multiple entry chunks found (${entryKeys.join(', ')}) — budgets.config.json assumes exactly one HTML entry.`,
    )
  }
  const entryKey = entryKeys[0]

  // --- Initial set: entry + everything statically reachable (imports only) ----
  const initialKeys = new Set([entryKey])
  const queue = [entryKey]
  while (queue.length > 0) {
    const key = queue.shift()
    for (const imp of manifest[key]?.imports ?? []) {
      if (!initialKeys.has(imp)) {
        initialKeys.add(imp)
        queue.push(imp)
      }
    }
  }

  // --- Lazy routes: only the config allowlist counts --------------------------
  const routeByFile = new Map()
  for (const src of Object.keys(lazyRoutesConfig)) {
    const info = manifest[src]
    if (!info) {
      throw new Error(
        `lazyRoutes: "${src}" is declared in budgets.config.json but not present in the build manifest. ` +
          `Was the module renamed or removed? Update budgets.config.json.`,
      )
    }
    if (!info.isDynamicEntry) {
      throw new Error(
        `lazyRoutes: "${src}" is no longer a dynamic entry in the build. ` +
          `A lazy route became statically imported — update budgets.config.json deliberately.`,
      )
    }
    routeByFile.set(info.file, src)
  }

  // Fail closed on any dynamic entry not on the allowlist.
  for (const [key, info] of Object.entries(manifest)) {
    if (!info.isDynamicEntry || routeByFile.has(info.file)) continue
    if (info.name && vendorNames.has(info.name)) {
      throw new Error(
        `vendor chunk "${info.name}" is itself a dynamic entry. Lazy-load a route module, not a vendor chunk.`,
      )
    }
    throw new Error(
      `Undeclared lazy route: "${key}" is dynamically imported but not allowlisted in budgets.config.json (lazyRoutes). ` +
        `This is exactly how a global budget gets gamed — code hidden in a chunk that loads on every visit. ` +
        `Declare it in lazyRoutes, or import it statically.`,
    )
  }

  // --- Coverage: classify every emitted JS file --------------------------------
  const coverage = new Map()
  const addCoverage = (file, status, extra = {}) => {
    const existing = coverage.get(file)
    if (!existing || existing.status !== 'initial') coverage.set(file, { status, ...extra })
    if (status === 'initial') coverage.set(file, { status: 'initial', ...extra })
  }

  for (const key of initialKeys) {
    const info = manifest[key]
    addCoverage(info.file, 'initial')
    for (const css of info.css ?? []) addCoverage(css, 'initial')
  }

  const vendorFiles = new Map([...vendorNames].map((name) => [name, []]))
  for (const [key, info] of Object.entries(manifest)) {
    if (!isJs(info.file)) continue
    if (info.name && vendorNames.has(info.name)) vendorFiles.get(info.name).push(info.file)
    if (initialKeys.has(key)) continue // already classified as initial
    if (info.isDynamicEntry && routeByFile.has(info.file)) {
      addCoverage(info.file, 'lazy-route', { route: routeByFile.get(info.file) })
      for (const css of info.css ?? []) addCoverage(css, 'lazy', { route: routeByFile.get(info.file) })
      continue
    }
    if (info.name && vendorNames.has(info.name) && !info.isDynamicEntry) {
      addCoverage(info.file, 'lazy-vendor', { vendor: info.name })
      for (const css of info.css ?? []) addCoverage(css, 'lazy', { vendor: info.name })
      continue
    }
    throw new Error(
      `Unclaimed chunk in build output: "${info.file}". It is not the entry, not statically reachable from the ` +
        `entry, not a named vendor chunk, and not a declared lazy route. Add it to budgets.config.json ` +
        `(vendorChunks or lazyRoutes) — an unclassified chunk is a hole in the budget system.`,
    )
  }

  // --- Vendor chunk structure invariants --------------------------------------
  for (const [name, vc] of Object.entries(vendorConfig)) {
    const keys = Object.keys(manifest).filter((k) => manifest[k].name === name && isJs(manifest[k].file))
    if (keys.length === 0) {
      throw new Error(
        `vendorChunks: "${name}" produced no chunk in this build. If it was intentionally removed, ` +
          `delete it from budgets.config.json.`,
      )
    }
    // (A vendor chunk that is itself a dynamic entry was already rejected
    //  by the fail-closed dynamic-entry check above.)
    const isInitial = keys.some((k) => initialKeys.has(k))
    if (vc.mustBeLazy && isInitial) {
      throw new Error(
        `vendor chunk "${name}" became statically reachable from the entry (mustBeLazy). ` +
          `Its bytes are now paid on every visit — import it behind a lazy route, or change budgets.config.json deliberately.`,
      )
    }
    if (vc.mustBeInitial && !isInitial) {
      throw new Error(
        `vendor chunk "${name}" is no longer statically reachable from the entry (mustBeInitial). ` +
          `If that is intentional, remove the mustBeInitial flag in budgets.config.json.`,
      )
    }
  }

  // --- Vendor attribution: verify packages against allowlists ------------------
  if (vendorNames.size > 0 && Object.keys(chunkModules).length === 0) {
    throw new Error(
      'No chunk-module data found (dist/.vite/chunk-modules.json missing or empty). ' +
        'Rebuild so vendor attribution can be verified — without it, chunk names are unverified claims.',
    )
  }
  const vendorPackages = new Map([...vendorNames].map((name) => [name, new Set()]))
  const attributionErrors = []
  for (const [fileName, cm] of Object.entries(chunkModules)) {
    const vendorName = cm?.name
    if (!vendorName || !vendorNames.has(vendorName)) continue
    for (const id of cm.modules ?? []) {
      const pkg = extractPackageName(id, root)
      if (!pkg) continue
      vendorPackages.get(vendorName).add(pkg)
      const violation = packageAllowlistViolation(pkg, vendorConfig[vendorName].packages ?? [])
      if (violation) {
        attributionErrors.push(`vendor chunk "${vendorName}": ${violation} (budgets.config.json → vendorChunks.${vendorName}.packages)`)
      }
    }
  }

  // --- Subtrees of each lazy route (transitively, incl. dynamicImports) --------
  const subtreeKeys = new Map()
  for (const src of Object.keys(lazyRoutesConfig)) {
    const seen = new Set([src])
    const q = [src]
    while (q.length > 0) {
      const key = q.shift()
      const info = manifest[key]
      if (!info) continue
      for (const imp of [...(info.imports ?? []), ...(info.dynamicImports ?? [])]) {
        if (!seen.has(imp)) {
          seen.add(imp)
          q.push(imp)
        }
      }
    }
    subtreeKeys.set(src, seen)
  }

  const routeFiles = {}
  for (const [file, src] of routeByFile) routeFiles[src] = file

  return {
    entryKey,
    entryFile: manifest[entryKey].file,
    initialKeys: [...initialKeys],
    coverage: Object.fromEntries(coverage),
    vendorFiles: Object.fromEntries([...vendorFiles].map(([n, files]) => [n, files])),
    vendorPackages: Object.fromEntries([...vendorPackages].map(([n, pkgs]) => [n, [...pkgs].sort()])),
    routeFiles,
    subtreeKeys: Object.fromEntries([...subtreeKeys].map(([src, keys]) => [src, [...keys]])),
    attributionErrors,
  }
}

// --- Size measurement (brotli, matching size-limit) ---------------------------

export function brotliSize(buf) {
  const out = brotliCompressSync(buf, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  })
  return out.length
}

// --- Budget evaluation ---------------------------------------------------------

function kb(n) {
  return `${n.toFixed(2)} kB`
}

/**
 * Compare measured sizes (in kB) against budgets.config.json.
 * `sizes` shape: { initialEntryJsKb, initialTotalJsKb, cssKb,
 *                  vendorKb: {name}, routeChunkKb: {src}, routeSubtreeKb: {src} }
 * Returns an array of failure messages (empty = pass).
 */
export function checkBudgets(sizes, config) {
  const failures = []
  const il = config.initialLoad ?? {}

  if (typeof il.entryJsLimitKb === 'number' && sizes.initialEntryJsKb > il.entryJsLimitKb) {
    failures.push(
      `Initial-load JS, entry chunks only: ${kb(sizes.initialEntryJsKb)} > ${il.entryJsLimitKb} kB brotli budget`,
    )
  }
  if (typeof il.totalJsLimitKb === 'number' && sizes.initialTotalJsKb > il.totalJsLimitKb) {
    failures.push(
      `Initial-load JS total (entry + statically reachable vendor chunks): ` +
        `${kb(sizes.initialTotalJsKb)} > ${il.totalJsLimitKb} kB brotli budget`,
    )
  }
  if (typeof il.cssLimitKb === 'number' && sizes.cssKb > il.cssLimitKb) {
    failures.push(`Initial-load CSS: ${kb(sizes.cssKb)} > ${il.cssLimitKb} kB brotli budget`)
  }

  for (const [name, vc] of Object.entries(config.vendorChunks ?? {})) {
    const actual = sizes.vendorKb?.[name]
    if (typeof vc.limitKb === 'number' && actual != null && actual > vc.limitKb) {
      failures.push(`Vendor chunk "${name}": ${kb(actual)} > ${vc.limitKb} kB brotli budget`)
    }
  }

  for (const [route, rc] of Object.entries(config.lazyRoutes ?? {})) {
    const chunk = sizes.routeChunkKb?.[route]
    if (typeof rc.chunkLimitKb === 'number' && chunk != null && chunk > rc.chunkLimitKb) {
      failures.push(`Lazy route "${route}" (own chunk): ${kb(chunk)} > ${rc.chunkLimitKb} kB brotli budget`)
    }
    const subtree = sizes.routeSubtreeKb?.[route]
    if (typeof rc.subtreeLimitKb === 'number' && subtree != null && subtree > rc.subtreeLimitKb) {
      failures.push(`Lazy route "${route}" (subtree, non-initial): ${kb(subtree)} > ${rc.subtreeLimitKb} kB brotli budget`)
    }
  }

  return failures
}
