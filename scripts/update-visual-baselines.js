#!/usr/bin/env node
/**
 * update-visual-baselines.js
 *
 * Regenerates all Playwright visual regression baselines and prints
 * instructions for reviewing and committing the updated screenshots.
 *
 * Usage:
 *   node scripts/update-visual-baselines.js
 *
 * The script builds the app (if not already built), starts the preview server
 * in the background, runs Playwright with --update-snapshots, then instructs
 * the developer to review and commit the changed files.
 */

import { execSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, 'dist')

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

// 1. Build if dist/ doesn't exist
if (!existsSync(DIST)) {
  console.log('No dist/ found. Building first…')
  run('npm run build')
} else {
  console.log('Using existing dist/. Run "npm run build" to refresh it first if needed.')
}

// 2. Run Playwright with --update-snapshots for the visual-regression project
console.log('\nRegenerating visual baselines (project: visual-regression)…')
const pw = spawn(
  'npx',
  ['playwright', 'test', '--project=visual-regression', '--update-snapshots'],
  { stdio: 'inherit', cwd: ROOT, shell: true },
)

pw.on('close', (code) => {
  if (code !== 0) {
    console.error(`\nPlaywright exited with code ${code}. Some baselines may not have been updated.`)
    process.exit(code ?? 1)
  }

  console.log(`
─────────────────────────────────────────────────────────
  Baselines updated in: e2e/snapshots/

  Next steps:
  1. Review the new screenshots in e2e/snapshots/
  2. Open the HTML report to visually inspect diffs:
       npx playwright show-report reports/playwright
  3. If the changes look correct, commit:
       git add e2e/snapshots/
       git commit -m "chore: update visual regression baselines"
─────────────────────────────────────────────────────────
`)
})
