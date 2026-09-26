/**
 * @file Shareable alert template bundles (#651).
 *
 * Versioned, strict (unknown fields rejected) zod schema for exporting/importing
 * alert rules. Secrets (signing secrets, bot tokens) are never part of the schema
 * and are stripped on export. Import validates first, then produces a preview
 * diff; nothing is applied until the caller commits.
 */
import { z } from 'zod'

export const BUNDLE_VERSION = 1

const condition = z
  .object({
    field: z.enum(['price', 'percentageChange']),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
    value: z.number().finite(),
    window: z.enum(['1hr', '24hr', '7d']).optional(),
  })
  .strict()

const rule = z
  .object({
    name: z.string().min(1).max(100),
    assetPair: z.string().min(1).max(32),
    logic: z.enum(['AND', 'OR']),
    conditions: z.array(condition).min(1).max(20),
    triggerOnce: z.boolean(),
    cooldownMinutes: z.number().int().min(0).max(10080),
    channels: z.array(z.enum(['inApp', 'email', 'webPush', 'webhook', 'telegram', 'discord'])).max(6),
    webhookUrl: z.string().url().startsWith('https://').optional(),
  })
  .strict()

export const alertBundleSchema = z
  .object({
    version: z.literal(BUNDLE_VERSION),
    exportedAt: z.string().datetime(),
    rules: z.array(rule).max(100),
  })
  .strict()

export type AlertBundle = z.infer<typeof alertBundleSchema>
export type BundleRule = z.infer<typeof rule>

const SECRET_KEY = /secret|token|signing|password/i

/** Builds a bundle, dropping any secret-looking keys defensively. */
export function exportBundle(rules: Array<BundleRule & Record<string, unknown>>, now = new Date()): string {
  const clean = rules.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_KEY.test(k))))
  const bundle = alertBundleSchema.parse({ version: BUNDLE_VERSION, exportedAt: now.toISOString(), rules: clean })
  return JSON.stringify(bundle, null, 2)
}

export interface ImportPreview {
  added: BundleRule[]
  changed: Array<{ before: BundleRule; after: BundleRule }>
  unchanged: BundleRule[]
}

export type ImportResult = { ok: true; bundle: AlertBundle; preview: ImportPreview } | { ok: false; errors: string[] }

/** Validates raw text and diffs against existing rules (matched by name). Never mutates state. */
export function previewImport(raw: string, existing: BundleRule[]): ImportResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, errors: ['Bundle is not valid JSON'] }
  }
  const parsed = alertBundleSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) }
  }
  const byName = new Map(existing.map((r) => [r.name, r]))
  const preview: ImportPreview = { added: [], changed: [], unchanged: [] }
  for (const after of parsed.data.rules) {
    const before = byName.get(after.name)
    if (!before) preview.added.push(after)
    else if (JSON.stringify(before) === JSON.stringify(after)) preview.unchanged.push(after)
    else preview.changed.push({ before, after })
  }
  return { ok: true, bundle: parsed.data, preview }
}
