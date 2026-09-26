// Packs the SDK and imports it from a temp consumer project, ESM and CJS.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const sdk = resolve('src/sdk')
const tmp = mkdtempSync(join(tmpdir(), 'sdk-smoke-'))
const tgz = execFileSync('npm', ['pack', '--pack-destination', tmp, '--silent'], { cwd: sdk }).toString().trim().split('\n').pop()
writeFileSync(join(tmp, 'package.json'), '{"name":"consumer","private":true}')
execFileSync('npm', ['install', '--no-audit', '--no-fund', join(tmp, tgz)], { cwd: tmp, stdio: 'inherit' })
const check = `const m=%s; for (const k of ['OracleClient','StreamClient','PriceHub','OracleError']) if(!m[k]) throw new Error('missing '+k); console.log('ok')`
writeFileSync(join(tmp, 'a.mjs'), check.replace('%s', "await import('@stellar-unified-price-oracle/sdk')"))
writeFileSync(join(tmp, 'b.cjs'), check.replace('%s', "require('@stellar-unified-price-oracle/sdk')"))
execFileSync('node', ['a.mjs'], { cwd: tmp, stdio: 'inherit' })
execFileSync('node', ['b.cjs'], { cwd: tmp, stdio: 'inherit' })
