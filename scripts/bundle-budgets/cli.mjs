#!/usr/bin/env node
/**
 * Structural bundle budget guard. See budgets.config.json for the rules and
 * scripts/bundle-budgets/lib.mjs for the (pure, unit-tested) logic.
 *
 * Usage: node scripts/bundle-budgets/cli.mjs [--dist dist]
 * Exits 1 on any structural violation, attribution violation, or budget breach.
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { brotliSize, checkBudgets, classifyChunks } from './lib.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseArgs(argv) {
  const args = { dist: path.join(REPO_ROOT, 'dist') }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dist') args.dist = path.resolve(REPO_ROOT, argv[++i])
  }
  return args
}

const KB = 1024
const toKb = (bytes) => bytes / KB

async function main() {
  const { dist } = parseArgs(process.argv)
  if (!existsSync(dist)) {
    console.error(`✗ ${dist} not found — run \`npm run build\` first.`)
    process.exit(1)
  }

  let config, manifest, chunkModules
  try {
    ;[config, manifest, chunkModules] = await Promise.all([
      readFile(path.join(REPO_ROOT, 'budgets.config.json'), 'utf8'),
      readFile(path.join(dist, '.vite/manifest.json'), 'utf8'),
      readFile(path.join(dist, '.vite/chunk-modules.json'), 'utf8'),
    ])
    config = JSON.parse(config)
    manifest = JSON.parse(manifest)
    chunkModules = JSON.parse(chunkModules)
  } catch (err) {
    console.error(`✗ Failed to load budget inputs: ${err.message}`)
    process.exit(1)
  }
  config.__chunkModules = chunkModules

  // --- Structural invariants (classifyChunks throws on violation) -----------
  let cls
  try {
    cls = classifyChunks(manifest, config, REPO_ROOT)
  } catch (err) {
    console.error('\n✗ Structural budget violations:\n')
    console.error(`  ✗ ${err.message}`)
    process.exit(1)
  }

  // --- Vendor attribution ----------------------------------------------------
  if (cls.attributionErrors.length > 0) {
    console.error('\n✗ Vendor attribution violations:\n')
    for (const e of cls.attributionErrors) console.error(`  ✗ ${e}`)
    console.error('\n  Add new dependencies to the right vendor chunk allowlist in budgets.config.json,')
    console.error('  or deliberately restructure the chunk layout — do not widen allowlists silently.')
    process.exit(1)
  }

  // --- Sizes (brotli, matching size-limit) ------------------------------------
  const sizeCache = new Map()
  const sizeOf = async (file) => {
    if (!sizeCache.has(file)) {
      sizeCache.set(file, brotliSize(await readFile(path.join(dist, file))))
    }
    return sizeCache.get(file)
  }

  const initialEntryFiles = [cls.entryFile]
  const initialOtherFiles = cls.initialKeys
    .flatMap((k) => [manifest[k].file, ...(manifest[k].css ?? [])])
    .filter((f) => f !== cls.entryFile)
  const initialEntryJsKb = toKb((await Promise.all(initialEntryFiles.map(sizeOf))).reduce((a, b) => a + b, 0))
  const initialOtherJsKb = toKb(
    (await Promise.all(initialOtherFiles.filter(isJsPath).map(sizeOf))).reduce((a, b) => a + b, 0),
  )
  const initialTotalJsKb = initialEntryJsKb + initialOtherJsKb
  const cssKb = toKb(
    (await Promise.all(cls.initialKeys.flatMap((k) => manifest[k].css ?? []).map(sizeOf))).reduce((a, b) => a + b, 0),
  )

  const vendorKb = {}
  for (const [name, files] of Object.entries(cls.vendorFiles)) {
    vendorKb[name] = toKb((await Promise.all(files.map(sizeOf))).reduce((a, b) => a + b, 0))
  }

  const routeChunkKb = {}
  const routeSubtreeKb = {}
  for (const src of Object.keys(config.lazyRoutes ?? {})) {
    const file = cls.routeFiles[src]
    routeChunkKb[src] = file ? toKb(await sizeOf(file)) : 0
    const nonInitialFiles = (cls.subtreeKeys[src] ?? [])
      .filter((k) => !cls.initialKeys.includes(k))
      .flatMap((k) => [manifest[k]?.file, ...(manifest[k]?.css ?? [])])
      .filter(Boolean)
    routeSubtreeKb[src] = toKb((await Promise.all(nonInitialFiles.map(sizeOf))).reduce((a, b) => a + b, 0))
  }

  // --- Verdict -----------------------------------------------------------------
  const failures = checkBudgets(
    { initialEntryJsKb, initialTotalJsKb, cssKb, vendorKb, routeChunkKb, routeSubtreeKb },
    config,
  )

  const il = config.initialLoad ?? {}
  console.log('\nBundle budget report (brotli):\n')
  console.log('  Initial load (paid on every visit):')
  console.log(`    entry chunk          ${initialEntryJsKb.toFixed(2).padStart(8)} kB / ${il.entryJsLimitKb} kB`)
  console.log(`    + reachable vendors  ${initialOtherJsKb.toFixed(2).padStart(8)} kB`)
  console.log(`    = total JS           ${initialTotalJsKb.toFixed(2).padStart(8)} kB / ${il.totalJsLimitKb} kB`)
  console.log(`    CSS                  ${cssKb.toFixed(2).padStart(8)} kB / ${il.cssLimitKb} kB`)
  for (const [name, files] of Object.entries(cls.vendorFiles)) {
    const vc = config.vendorChunks[name] ?? {}
    for (const f of files) {
      const flags = vc.mustBeLazy ? ' [mustBeLazy]' : vc.mustBeInitial ? ' [mustBeInitial]' : ''
      console.log(`  Vendor "${name}"${flags}: ${f}`)
    }
    console.log(`    size                 ${(vendorKb[name] ?? 0).toFixed(2).padStart(8)} kB / ${vc.limitKb ?? '—'} kB`)
    console.log(`    packages: ${cls.vendorPackages[name]?.join(', ')}`)
  }
  for (const src of Object.keys(config.lazyRoutes ?? {})) {
    const rc = config.lazyRoutes[src] ?? {}
    console.log(`  Lazy route "${src}":`)
    console.log(`    own chunk            ${(routeChunkKb[src] ?? 0).toFixed(2).padStart(8)} kB / ${rc.chunkLimitKb ?? '—'} kB`)
    console.log(`    non-initial subtree  ${(routeSubtreeKb[src] ?? 0).toFixed(2).padStart(8)} kB / ${rc.subtreeLimitKb ?? '—'} kB`)
  }

  if (failures.length > 0) {
    console.error('\n✗ Budget breaches:\n')
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }

  console.log('\n✓ All bundle budgets pass: coverage, initial-load boundary, vendor attribution, and size.')
}

function isJsPath(file) {
  return /\.js$/i.test(file)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
