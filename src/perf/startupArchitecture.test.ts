import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readSource(relativePath: string): string {
  return readFileSync(resolve(srcDir, relativePath), 'utf8')
}

/**
 * The stage budgets in `startup.ts` are only meaningful while the boot path
 * actually records them. These guards fail fast if the wiring is removed or
 * reordered, so the report can't silently go empty.
 */
describe('startup stage wiring', () => {
  const main = readSource('main.tsx')

  it('starts the boot clock before rendering', () => {
    expect(main).toContain('markBoot()')
    expect(main.indexOf('markBoot()')).toBeLessThan(main.indexOf('createRoot('))
  })

  it('records the shell stage after the first paint', () => {
    expect(main).toContain('afterFirstPaint(')
    expect(main).toContain("markStage('shell')")
    expect(main.indexOf('afterFirstPaint(')).toBeGreaterThan(main.indexOf('createRoot('))
  })

  it('records the idle stage via runWhenIdle', () => {
    expect(main).toContain('runWhenIdle(')
    expect(main).toContain("markStage('idle')")
  })

  it('records the data stages from the price context', () => {
    const priceContext = readSource('context/PriceContext.tsx')
    expect(priceContext).toContain("markStage('first-price'")
    expect(priceContext).toContain("markStage('live')")
  })
})
