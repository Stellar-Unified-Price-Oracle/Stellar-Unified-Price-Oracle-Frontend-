/**
 * Pins the Content-Security-Policy so it cannot quietly loosen again.
 *
 * The policy has drifted before: DEPLOYMENT.md advised operators to ship
 * `script-src 'self' 'unsafe-inline'`, and `style-src 'unsafe-inline'` was
 * described as a Tailwind requirement when Tailwind actually needs nothing of
 * the sort. Neither regression is caught by a browser — a loose policy works
 * perfectly, which is exactly what makes it dangerous. These assertions fail
 * the unit suite instead.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

interface HeaderRule {
  key: string
  value: string
}

function cspFromVercel(): string {
  const config = JSON.parse(readRepoFile('vercel.json')) as {
    headers: Array<{ source: string; headers: HeaderRule[] }>
  }

  for (const rule of config.headers) {
    const header = rule.headers.find((h) => h.key.toLowerCase() === 'content-security-policy')
    if (header) return header.value
  }

  throw new Error('vercel.json declares no Content-Security-Policy header')
}

function cspFromNetlify(): string {
  const match = /^\s*Content-Security-Policy\s*=\s*"([^"]+)"/m.exec(readRepoFile('netlify.toml'))
  if (!match) throw new Error('netlify.toml declares no Content-Security-Policy header')
  return match[1]
}

function parseDirectives(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>()

  for (const part of policy.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [name, ...sources] = trimmed.split(/\s+/)
    directives.set(name.toLowerCase(), sources)
  }

  return directives
}

const vercelPolicy = cspFromVercel()
const vercelDirectives = parseDirectives(vercelPolicy)

describe('CSP: cross-target consistency', () => {
  it('keeps netlify.toml identical to vercel.json', () => {
    // Netlify is a documented alternative target. Shipping the same app with a
    // weaker policy on one host is how "strict on paper" happens.
    expect(cspFromNetlify()).toBe(vercelPolicy)
  })
})

describe('CSP: script-src', () => {
  it('never allows inline scripts or eval', () => {
    const sources = vercelDirectives.get('script-src')

    expect(sources, 'script-src is missing').toBeDefined()
    expect(sources).not.toContain("'unsafe-inline'")
    expect(sources).not.toContain("'unsafe-eval'")
  })

  it('restricts scripts to the app origin', () => {
    expect(vercelDirectives.get('script-src')).toEqual(["'self'"])
  })
})

describe('CSP: styles', () => {
  it('does not relax the stylesheet directive', () => {
    // The whole point of splitting style-src: stylesheets stay pinned to the
    // app origin plus Google Fonts, while only inline `style` *attributes* are
    // allowed. Collapsing this back reintroduces CSS-level exfiltration.
    const sources = vercelDirectives.get('style-src-elem')

    expect(sources, 'style-src-elem is missing — was style-src collapsed?').toBeDefined()
    expect(sources).not.toContain("'unsafe-inline'")
    expect(sources).toContain("'self'")
    expect(sources).toContain('https://fonts.googleapis.com')
  })

  it('allows inline style attributes, which React components need', () => {
    // Removing this breaks dynamic bar widths, chart colours and crosshair
    // position — a policy so strict the app breaks is also a failure.
    expect(vercelDirectives.get('style-src-attr')).toContain("'unsafe-inline'")
  })

  it('has no blanket style-src carrying an inline allowance', () => {
    const blanket = vercelDirectives.get('style-src')

    if (blanket) expect(blanket).not.toContain("'unsafe-inline'")
  })
})

describe('CSP: workers and hardening directives', () => {
  it('requires workers to be same-origin files', () => {
    // src/workers/ instantiates workers via `new Worker(new URL(...))`, which
    // Vite emits as same-origin files — the previous `blob:` allowance was
    // granted for nothing.
    expect(vercelDirectives.get('worker-src')).toEqual(["'self'"])
  })

  it('keeps the structural hardening directives', () => {
    expect(vercelDirectives.get('object-src')).toEqual(["'none'"])
    expect(vercelDirectives.get('base-uri')).toEqual(["'self'"])
    expect(vercelDirectives.get('frame-ancestors')).toEqual(["'none'"])
    expect(vercelDirectives.get('form-action')).toEqual(["'self'"])
  })
})

describe('offline fallback page', () => {
  // Comments are not parsed as markup, so strip them before looking for
  // inline constructs — the explanatory comment here names both of them.
  const offlineHtml = readRepoFile('public/offline.html').replace(/<!--[\s\S]*?-->/g, '')

  it('contains no inline styles, because style-src-elem blocks them', () => {
    expect(offlineHtml).not.toMatch(/<style[\s>]/i)
  })

  it('contains no inline event handlers, because script-src blocks them', () => {
    // This was a live bug: the retry button used onclick="location.reload()",
    // which `script-src 'self'` blocks, so users offline could not retry.
    expect(offlineHtml).not.toMatch(/\son[a-z]+\s*=/i)
  })

  it('loads its CSS and JS from same-origin files', () => {
    expect(offlineHtml).toContain('/offline.css')
    expect(offlineHtml).toContain('/offline.js')

    expect(readRepoFile('public/offline.css').length).toBeGreaterThan(0)
    expect(readRepoFile('public/offline.js')).toContain('addEventListener')
  })

  it('precaches those files so the page works without a network', () => {
    const sw = readRepoFile('public/sw.js')

    expect(sw).toContain('offline.css')
    expect(sw).toContain('offline.js')
  })
})
