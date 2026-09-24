import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readSource(relativePath: string): string {
  return readFileSync(resolve(srcDir, relativePath), 'utf8')
}

/** Type-only imports are erased at build time and do not pull code into a chunk. */
function stripTypeImports(source: string): string {
  return source.replace(/^\s*import\s+type\s[^\n]*\n/gm, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * These modules sit outside the critical path. They must only be reached
 * through a dynamic import(); a static import would pull them back into the
 * entry chunk and re-create the all-at-once boot this staging exists to avoid.
 */
const DEFERRED_MODULES = [
  { file: 'pages/Dashboard.tsx', specifier: '../components/AlertModal' },
  { file: 'pages/PriceDetail.tsx', specifier: '../components/AlertModal' },
  { file: 'components/Layout.tsx', specifier: './SettingsPanel' },
  { file: 'hooks/useWebVitals.ts', specifier: 'web-vitals' },
] as const

describe('staged startup architecture', () => {
  for (const { file, specifier } of DEFERRED_MODULES) {
    it(`${file} loads ${specifier} on demand`, () => {
      const source = stripTypeImports(readSource(file))
      expect(source).toContain(`import('${specifier}')`)
      expect(source).not.toMatch(
        new RegExp(`from\\s+['"]${escapeRegExp(specifier)}['"]`),
      )
    })
  }

  it('PriceContext opens the socket only after the shell has painted', () => {
    const source = readSource('context/PriceContext.tsx')
    const paintIndex = source.indexOf('afterFirstPaint(')
    const connectIndex = source.indexOf('client.connect()')

    expect(paintIndex).toBeGreaterThanOrEqual(0)
    expect(connectIndex).toBeGreaterThan(paintIndex)
  })

  it('main.tsx records the shell stage after first paint', () => {
    const source = readSource('main.tsx')
    expect(source).toContain('markBoot()')
    expect(source).toContain("markStage('shell')")
    expect(source.indexOf('afterFirstPaint(')).toBeGreaterThan(source.indexOf('createRoot('))
  })
})
