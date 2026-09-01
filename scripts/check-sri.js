#!/usr/bin/env node
/**
 * Fails CI when a third-party (cross-origin) <script> or <link rel="stylesheet">
 * is added without a Subresource Integrity `integrity` attribute, unless the
 * asset's host is documented in sri-exceptions.json with a reason and review
 * date.
 *
 * Scans:
 *  - index.html (and dist/index.html if a build has been run) for static tags
 *  - src/**\/*.{ts,tsx} for dynamically injected <script>/<link> src/href
 *    assignments, so new CDN dependencies added in JS don't slip through
 *    un-reviewed either.
 *
 * Usage: node scripts/check-sri.js
 */
import { readFileSync, existsSync, globSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const exceptionsPath = path.join(rootDir, 'sri-exceptions.json')

function loadExceptions() {
  const raw = JSON.parse(readFileSync(exceptionsPath, 'utf8'))
  const hosts = new Map()
  const today = new Date().toISOString().slice(0, 10)
  const stale = []
  for (const ex of raw.exceptions ?? []) {
    if (!ex.host || !ex.reason || !ex.reviewBy) {
      throw new Error(`Malformed exception entry in sri-exceptions.json: ${JSON.stringify(ex)}`)
    }
    if (ex.reviewBy < today) stale.push(ex)
    hosts.set(ex.host, ex)
  }
  return { hosts, stale }
}

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/** Find external <script src=...> / <link rel="stylesheet" href=...> tags missing `integrity`. */
function scanHtml(file, hosts, problems) {
  if (!existsSync(file)) return
  const html = readFileSync(file, 'utf8')
  const tagRe = /<(script|link)\b[^>]*>/gi
  let m
  while ((m = tagRe.exec(html))) {
    const tag = m[0]
    const isLink = m[1].toLowerCase() === 'link'
    if (isLink && !/rel=["']stylesheet["']/i.test(tag)) continue
    const urlAttr = isLink ? /href=["']([^"']+)["']/i : /src=["']([^"']+)["']/i
    const urlMatch = tag.match(urlAttr)
    if (!urlMatch) continue
    const url = urlMatch[1]
    if (!/^https?:\/\//i.test(url)) continue // same-origin, not relevant
    const host = hostOf(url)
    const hasIntegrity = /\bintegrity=/.test(tag)
    if (hasIntegrity) continue
    const exception = host && hosts.get(host)
    if (exception) continue
    problems.push({ file: path.relative(rootDir, file), url, host })
  }
}

/** Find `.src = 'https://...'` / `` `https://...` `` style dynamic script/link injection in app code. */
function scanSource(files, hosts, problems) {
  const assignRe = /\.(?:src|href)\s*=\s*[`'"]https?:\/\/([^`'"/]+)/g
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
    let m
    while ((m = assignRe.exec(code))) {
      const host = m[1]
      if (hosts.get(host)) continue
      problems.push({ file: path.relative(rootDir, file), url: m[0].split(/[`'"]/).pop(), host })
    }
  }
}

function main() {
  const { hosts, stale } = loadExceptions()
  const problems = []

  scanHtml(path.join(rootDir, 'index.html'), hosts, problems)
  scanHtml(path.join(rootDir, 'dist', 'index.html'), hosts, problems)

  const sourceFiles = globSync('src/**/*.{ts,tsx}', { cwd: rootDir }).map((f) => path.join(rootDir, f))
  scanSource(sourceFiles, hosts, problems)

  if (stale.length) {
    console.warn('⚠️  SRI exceptions past their review date (re-review sri-exceptions.json):')
    for (const ex of stale) console.warn(`   - ${ex.host} (reviewBy: ${ex.reviewBy})`)
  }

  if (problems.length) {
    console.error('❌ Third-party assets without SRI or a documented exception:\n')
    for (const p of problems) {
      console.error(`   ${p.file}: ${p.url}`)
    }
    console.error(
      '\nAdd an `integrity` (+ `crossorigin`) attribute for hashable static assets, or, if the response ' +
        'body cannot be pinned (content negotiation, third-party auto-updates, etc.), add a reviewed entry ' +
        'to sri-exceptions.json with a `reason` and `reviewBy` date.',
    )
    process.exit(1)
  }

  console.log(`✅ SRI check passed (${hosts.size} documented exception(s), 0 unreviewed external assets).`)
}

main()
