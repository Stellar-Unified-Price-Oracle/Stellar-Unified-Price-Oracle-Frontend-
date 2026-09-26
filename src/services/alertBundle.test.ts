import { describe, it, expect } from 'vitest'
import { exportBundle, previewImport, type BundleRule } from './alertBundle'

const r: BundleRule = {
  name: 'BTC high', assetPair: 'BTC/USD', logic: 'AND',
  conditions: [{ field: 'price', operator: 'gte', value: 70000 }],
  triggerOnce: false, cooldownMinutes: 5, channels: ['webhook'], webhookUrl: 'https://example.com/h',
}

describe('alertBundle', () => {
  it('round-trips losslessly and strips secrets', () => {
    const out = exportBundle([{ ...r, signingSecret: 'x' }])
    expect(out).not.toContain('signingSecret')
    const res = previewImport(out, [])
    expect(res.ok && res.bundle.rules[0]).toEqual(r)
    expect(res.ok && res.preview.added).toHaveLength(1)
  })
  it('rejects unknown fields and bad JSON', () => {
    const bad = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rules: [{ ...r, evil: 1 }] })
    expect(previewImport(bad, []).ok).toBe(false)
    expect(previewImport('{', []).ok).toBe(false)
  })
  it('diffs changed rules', () => {
    const res = previewImport(exportBundle([r]), [{ ...r, cooldownMinutes: 1 }])
    expect(res.ok && res.preview.changed).toHaveLength(1)
  })
})
