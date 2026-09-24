import { describe, expect, it } from 'vitest'
import {
  brotliSize,
  checkBudgets,
  classifyChunks,
  extractPackageName,
  packageAllowlistViolation,
} from './lib.mjs'

const ROOT = '/repo'

// --- Synthetic fixtures -------------------------------------------------------

function makeManifest(overrides = {}) {
  return {
    'index.html': {
      file: 'assets/index-abc.js',
      name: 'index',
      isEntry: true,
      imports: ['_vendor-react.js'],
      dynamicImports: ['src/pages/PriceDetail.tsx'],
      css: ['assets/index.css'],
      ...overrides.entry,
    },
    '_vendor-react.js': {
      file: 'assets/vendor-react-abc.js',
      name: 'vendor-react',
      ...overrides.vendorReact,
    },
    '_vendor-charts.js': {
      file: 'assets/vendor-charts-abc.js',
      name: 'vendor-charts',
      ...overrides.vendorCharts,
    },
    'src/pages/PriceDetail.tsx': {
      file: 'assets/PriceDetail-abc.js',
      name: 'PriceDetail',
      isDynamicEntry: true,
      imports: ['_vendor-react.js', '_vendor-charts.js'],
      ...overrides.route,
    },
  }
}

function makeConfig(overrides = {}) {
  return {
    initialLoad: {},
    vendorChunks: {
      'vendor-react': { packages: ['react'] },
      'vendor-charts': { packages: ['recharts'], mustBeLazy: true },
    },
    lazyRoutes: {
      'src/pages/PriceDetail.tsx': {},
    },
    __chunkModules: {
      'assets/vendor-react-abc.js': {
        name: 'vendor-react',
        modules: [`${ROOT}/node_modules/react/index.js`],
      },
      'assets/vendor-charts-abc.js': {
        name: 'vendor-charts',
        modules: [`${ROOT}/node_modules/recharts/es6/index.js`],
      },
    },
    ...overrides,
  }
}

// --- extractPackageName --------------------------------------------------------

describe('extractPackageName', () => {
  it('extracts a plain package under node_modules', () => {
    expect(extractPackageName(`${ROOT}/node_modules/react/index.js`, ROOT)).toBe('react')
  })

  it('extracts a scoped package', () => {
    expect(extractPackageName(`${ROOT}/node_modules/@babel/runtime/helpers.js`, ROOT)).toBe(
      '@babel/runtime',
    )
  })

  it('handles pnpm-style .pnpm store paths', () => {
    const id = `${ROOT}/node_modules/.pnpm/lodash@4.17.21/node_modules/lodash/lodash.js`
    expect(extractPackageName(id, ROOT)).toBe('lodash')
  })

  it('strips vite query suffixes', () => {
    expect(extractPackageName(`${ROOT}/node_modules/react/index.js?commonjs-exports`, ROOT)).toBe(
      'react',
    )
  })

  it('returns null for first-party app code', () => {
    expect(extractPackageName(`${ROOT}/src/pages/Dashboard.tsx`, ROOT)).toBeNull()
  })

  it('normalizes windows-style separators', () => {
    expect(extractPackageName('C:\\repo\\node_modules\\react\\index.js', 'C:/repo')).toBe('react')
  })
})

describe('packageAllowlistViolation', () => {
  it('passes allowlisted packages', () => {
    expect(packageAllowlistViolation('react', ['react', 'scheduler'])).toBeNull()
  })

  it('flags packages missing from the allowlist', () => {
    expect(packageAllowlistViolation('lodash', ['react'])).toMatch(/lodash/)
  })
})

// --- classifyChunks ------------------------------------------------------------

describe('classifyChunks', () => {
  it('classifies entry, initial vendors, lazy vendors and lazy routes', () => {
    const result = classifyChunks(makeManifest(), makeConfig(), ROOT)

    expect(result.entryFile).toBe('assets/index-abc.js')
    expect(result.initialKeys).toContain('index.html')
    expect(result.initialKeys).toContain('_vendor-react.js')
    expect(result.initialKeys).not.toContain('_vendor-charts.js')
    expect(result.coverage['assets/index-abc.js'].status).toBe('initial')
    expect(result.coverage['assets/vendor-react-abc.js'].status).toBe('initial')
    expect(result.coverage['assets/vendor-charts-abc.js']).toMatchObject({
      status: 'lazy-vendor',
      vendor: 'vendor-charts',
    })
    expect(result.coverage['assets/PriceDetail-abc.js']).toMatchObject({
      status: 'lazy-route',
      route: 'src/pages/PriceDetail.tsx',
    })
  })

  it('computes lazy-route subtrees through imports and dynamicImports', () => {
    const result = classifyChunks(makeManifest(), makeConfig(), ROOT)
    expect(result.subtreeKeys['src/pages/PriceDetail.tsx']).toEqual(
      expect.arrayContaining([
        'src/pages/PriceDetail.tsx',
        '_vendor-react.js',
        '_vendor-charts.js',
      ]),
    )
  })

  it('fails closed on an undeclared dynamic entry', () => {
    const manifest = makeManifest()
    manifest['src/pages/Sneaky.tsx'] = {
      file: 'assets/Sneaky-abc.js',
      name: 'Sneaky',
      isDynamicEntry: true,
    }
    manifest['index.html'].dynamicImports.push('src/pages/Sneaky.tsx')

    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/Undeclared lazy route/)
  })

  it('fails when a declared lazy route is missing from the manifest', () => {
    const config = makeConfig()
    config.lazyRoutes['src/pages/Ghost.tsx'] = {}
    expect(() => classifyChunks(makeManifest(), config, ROOT)).toThrow(
      /declared in budgets.config.json but not present/,
    )
  })

  it('fails when a declared lazy route stops being dynamically imported', () => {
    const manifest = makeManifest({ route: { isDynamicEntry: false } })
    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/no longer a dynamic entry/)
  })

  it('fails when a mustBeLazy vendor chunk becomes statically reachable', () => {
    const manifest = makeManifest()
    manifest['index.html'].imports.push('_vendor-charts.js')
    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/mustBeLazy/)
  })

  it('fails when a vendor chunk itself becomes a dynamic entry', () => {
    const manifest = makeManifest({ vendorCharts: { isDynamicEntry: true } })
    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/dynamic entry/)
  })

  it('fails when an unclaimed chunk appears in the output', () => {
    const manifest = makeManifest()
    manifest['_vendor-mystery.js'] = { file: 'assets/vendor-mystery-abc.js', name: 'vendor-mystery' }
    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/Unclaimed chunk/)
  })

  it('fails when a configured vendor chunk produces no output', () => {
    const manifest = makeManifest()
    delete manifest['_vendor-charts.js']
    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/produced no chunk/)
  })

  it('fails when there is no entry chunk', () => {
    const manifest = makeManifest({ entry: { isEntry: undefined } })
    expect(() => classifyChunks(manifest, makeConfig(), ROOT)).toThrow(/No entry chunk/)
  })

  it('reports attribution errors for non-allowlisted packages with the package named', () => {
    const config = makeConfig()
    config.__chunkModules['assets/vendor-react-abc.js'].modules.push(
      `${ROOT}/node_modules/lodash/lodash.js`,
    )
    const result = classifyChunks(makeManifest(), config, ROOT)
    expect(result.attributionErrors).toHaveLength(1)
    expect(result.attributionErrors[0]).toContain('lodash')
    expect(result.attributionErrors[0]).toContain('vendor-react')
  })

  it('collects the set of packages actually bundled per vendor chunk', () => {
    const result = classifyChunks(makeManifest(), makeConfig(), ROOT)
    expect(result.vendorPackages['vendor-react']).toEqual(['react'])
    expect(result.vendorPackages['vendor-charts']).toEqual(['recharts'])
  })

  it('requires chunk-module data when vendor chunks are configured', () => {
    const config = makeConfig()
    config.__chunkModules = {}
    expect(() => classifyChunks(makeManifest(), config, ROOT)).toThrow(/chunk-module data/)
  })
})

// --- brotliSize ------------------------------------------------------------------

describe('brotliSize', () => {
  it('measures compressed size deterministically', () => {
    const buf = Buffer.from('x'.repeat(10_000))
    expect(brotliSize(buf)).toBe(brotliSize(buf))
    expect(brotliSize(buf)).toBeLessThan(buf.length)
  })
})

// --- checkBudgets -------------------------------------------------------------------

describe('checkBudgets', () => {
  const config = {
    initialLoad: { entryJsLimitKb: 10, totalJsLimitKb: 50, cssLimitKb: 5 },
    vendorChunks: {
      'vendor-react': { limitKb: 40 },
      'vendor-charts': { limitKb: 90 },
    },
    lazyRoutes: {
      'src/pages/PriceDetail.tsx': { chunkLimitKb: 4, subtreeLimitKb: 95 },
    },
  }

  const passingSizes = {
    initialEntryJsKb: 9,
    initialTotalJsKb: 49,
    cssKb: 4.5,
    vendorKb: { 'vendor-react': 39, 'vendor-charts': 89 },
    routeChunkKb: { 'src/pages/PriceDetail.tsx': 3 },
    routeSubtreeKb: { 'src/pages/PriceDetail.tsx': 94 },
  }

  it('passes when all sizes are within budget', () => {
    expect(checkBudgets(passingSizes, config)).toEqual([])
  })

  it('detects an entry-chunk breach', () => {
    const failures = checkBudgets({ ...passingSizes, initialEntryJsKb: 12 }, config)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('entry chunks only')
  })

  it('detects an initial-total breach', () => {
    const failures = checkBudgets({ ...passingSizes, initialTotalJsKb: 51 }, config)
    expect(failures[0]).toContain('Initial-load JS total')
  })

  it('detects a vendor-chunk breach and names the chunk', () => {
    const failures = checkBudgets(
      { ...passingSizes, vendorKb: { 'vendor-react': 41, 'vendor-charts': 89 } },
      config,
    )
    expect(failures[0]).toContain('"vendor-react"')
  })

  it('detects lazy-route chunk and subtree breaches', () => {
    const failures = checkBudgets(
      {
        ...passingSizes,
        routeChunkKb: { 'src/pages/PriceDetail.tsx': 5 },
        routeSubtreeKb: { 'src/pages/PriceDetail.tsx': 96 },
      },
      config,
    )
    expect(failures).toHaveLength(2)
    expect(failures.join('\n')).toContain('own chunk')
    expect(failures.join('\n')).toContain('subtree')
  })

  it('ignores budgets that are not numbers', () => {
    const partial = { initialLoad: {}, vendorChunks: {}, lazyRoutes: {} }
    expect(checkBudgets({ ...passingSizes, initialEntryJsKb: 9999 }, partial)).toEqual([])
  })
})
