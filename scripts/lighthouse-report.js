#!/usr/bin/env node
/**
 * lighthouse-report.js (#503)
 *
 * Reads the Lighthouse CI results written by `lhci autorun` (filesystem
 * upload target, see .lighthouserc.json) and posts/updates a single PR
 * comment with the key metrics per route, their budget pass/fail state, and
 * the delta against the last baseline run on the base branch (cached via
 * actions/cache — see .github/workflows/lighthouse.yml).
 *
 * Usage: node scripts/lighthouse-report.js
 *
 * Environment variables:
 *   GITHUB_TOKEN       — required to comment on the PR
 *   GITHUB_REPOSITORY  — "owner/repo" (set by GitHub Actions)
 *   PR_NUMBER          — pull request number to comment on
 *   BASELINE_SUMMARY   — path to a previous run's summary.json, if a cache hit occurred
 *   BASELINE_OUT       — path to write this run's summary.json for the next baseline cache
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RESULTS_DIR = '.lighthouseci'
const COMMENT_MARKER = '<!-- lighthouse-ci-report -->'

const METRICS = [
  { key: 'largest-contentful-paint', label: 'LCP', unit: 'ms', budget: 2500 },
  { key: 'cumulative-layout-shift', label: 'CLS', unit: '', budget: 0.1 },
  { key: 'total-blocking-time', label: 'TBT', unit: 'ms', budget: 300 },
]

function loadManifest() {
  const path = join(RESULTS_DIR, 'manifest.json')
  if (!existsSync(path)) {
    console.error(`No ${path} found — did "lhci autorun" run first?`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/** Picks lhci's chosen representative run per URL and extracts the numbers we report on. */
function summarize(manifest) {
  const byUrl = new Map()
  for (const run of manifest) {
    if (!run.isRepresentativeRun) continue
    const lhr = JSON.parse(readFileSync(run.jsonPath, 'utf-8'))
    const metrics = Object.fromEntries(
      METRICS.map((m) => [m.key, lhr.audits[m.key]?.numericValue ?? null]),
    )
    byUrl.set(run.url, {
      url: run.url,
      performanceScore: lhr.categories.performance?.score ?? null,
      accessibilityScore: lhr.categories.accessibility?.score ?? null,
      metrics,
    })
  }
  return Object.fromEntries(byUrl)
}

function fmt(value, unit) {
  if (value === null || value === undefined) return 'n/a'
  return unit === 'ms' ? `${Math.round(value)} ms` : value.toFixed(3)
}

function delta(current, baseline, unit) {
  if (current === null || baseline === null || baseline === undefined) return ''
  const diff = current - baseline
  if (Math.abs(diff) < (unit === 'ms' ? 1 : 0.001)) return ' (±0)'
  const sign = diff > 0 ? '+' : ''
  const formatted = unit === 'ms' ? `${sign}${Math.round(diff)} ms` : `${sign}${diff.toFixed(3)}`
  // Lower is better for every metric we track here.
  const arrow = diff > 0 ? '🔺' : '🔻'
  return ` (${formatted} ${arrow})`
}

function buildComment(summary, baseline) {
  const rows = Object.values(summary).map((page) => {
    const base = baseline?.[page.url]
    const metricCells = METRICS.map((m) => {
      const value = page.metrics[m.key]
      const pass = value !== null && value <= m.budget
      const cell = `${fmt(value, m.unit)}${delta(value, base?.metrics?.[m.key], m.unit)}`
      return `${pass ? '✅' : '❌'} ${cell}`
    })
    const a11yPass = (page.accessibilityScore ?? 0) >= 0.9
    return [
      `\`${new URL(page.url).pathname || '/'}\``,
      ...metricCells,
      `${a11yPass ? '✅' : '❌'} ${Math.round((page.accessibilityScore ?? 0) * 100)}`,
    ].join(' | ')
  })

  const header = `| Route | ${METRICS.map((m) => m.label).join(' | ')} | a11y |`
  const sep = `|---|${METRICS.map(() => '---').join('|')}|---|`

  return [
    COMMENT_MARKER,
    '### 🔦 Lighthouse CI report',
    '',
    'Budgets: LCP ≤ 2500ms · CLS ≤ 0.1 · TBT ≤ 300ms · a11y ≥ 90.',
    baseline ? '_Δ vs. the last run on the base branch._' : '_No baseline run to diff against yet._',
    '',
    header,
    sep,
    ...rows,
  ].join('\n')
}

async function postOrUpdateComment(body) {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  const prNumber = process.env.PR_NUMBER
  if (!token || !repo || !prNumber) {
    console.log('Not running in a PR context (missing GITHUB_TOKEN/GITHUB_REPOSITORY/PR_NUMBER) — skipping comment.')
    return
  }

  const api = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  const existing = await fetch(api, { headers }).then((r) => r.json())
  const previous = Array.isArray(existing) ? existing.find((c) => c.body?.includes(COMMENT_MARKER)) : null

  if (previous) {
    await fetch(`https://api.github.com/repos/${repo}/issues/comments/${previous.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body }),
    })
  } else {
    await fetch(api, { method: 'POST', headers, body: JSON.stringify({ body }) })
  }
}

async function main() {
  const manifest = loadManifest()
  const summary = summarize(manifest)

  let baseline = null
  const baselinePath = process.env.BASELINE_SUMMARY
  if (baselinePath && existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
  }

  const body = buildComment(summary, baseline)
  console.log(body)
  await postOrUpdateComment(body)

  const outPath = process.env.BASELINE_OUT
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(summary, null, 2))
  }

  // Fail the job if any budget assertion failed — mirrors `lhci assert`'s own
  // exit code, kept here too so this script can be the single source of truth
  // for the "budget violations fail CI" acceptance criterion when re-run alone.
  const anyFailure = Object.values(summary).some(
    (page) =>
      METRICS.some((m) => page.metrics[m.key] === null || page.metrics[m.key] > m.budget) ||
      (page.accessibilityScore ?? 0) < 0.9,
  )
  if (anyFailure) {
    console.error('One or more Lighthouse budgets were exceeded.')
    process.exitCode = 1
  }
}

// Guard against readdirSync being unused if RESULTS_DIR layout changes; kept
// as a cheap sanity check that lhci actually wrote output files.
if (existsSync(RESULTS_DIR) && readdirSync(RESULTS_DIR).length === 0) {
  console.error(`${RESULTS_DIR} is empty — lhci did not produce any results.`)
  process.exit(1)
}

await main()
