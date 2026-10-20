/**
 * @file Import and export of user preferences (#819).
 *
 * Preferences leave the app as a versioned JSON envelope:
 *
 * ```json
 * { "format": "supo-preferences", "schemaVersion": 1, "exportedAt": "…", "preferences": { … } }
 * ```
 *
 * On import the envelope is checked in three steps, and each step returns a
 * readable error instead of throwing:
 *
 * 1. the text must be JSON and carry our `format` marker,
 * 2. `schemaVersion` must be one this build understands (newer files are refused,
 *    older ones go through `MIGRATIONS` before validation),
 * 3. every portable field must match its Zod schema. Unknown fields are dropped.
 *
 * Only the portable subset in {@link PORTABLE_KEYS} is ever exported or imported.
 * `analyticsOptOut` and `backtestPresets` are deliberately excluded: the first is a
 * per-browser privacy choice, and the second is large and tied to local history.
 */
import { z } from 'zod'
import type { Preferences } from './types'

export const PREFERENCES_FORMAT = 'supo-preferences'
export const PREFERENCES_SCHEMA_VERSION = 1

export const PORTABLE_KEYS = [
  'refreshInterval',
  'chartTimeRange',
  'chartHistoryPageSize',
  'staleThresholdMinutes',
  'sourcePriority',
  'onChainDivergenceThresholdPercent',
  'dashboardView',
  'cardOrder',
  'reducedMotion',
  'highContrast',
  'largeText',
  'rtlEnabled',
  'chartTimezone',
  'formatLocale',
  'showExcludedSources',
] as const

export type PortablePreferences = Pick<Preferences, (typeof PORTABLE_KEYS)[number]>

const MAX_LIST_LENGTH = 50

/**
 * Field schemas for schema version 1. Enum options mirror the unions in
 * `types.ts`, so a file can never introduce a value the UI cannot render.
 */
const portableSchemaV1 = z.object({
  refreshInterval: z.union([z.literal(5000), z.literal(10000), z.literal(30000), z.literal(60000), z.literal(300000)]),
  chartTimeRange: z.enum(['24h', '7d', '30d']),
  chartHistoryPageSize: z.union([z.literal(50), z.literal(100), z.literal(250)]),
  staleThresholdMinutes: z.number().finite().min(1).max(60),
  sourcePriority: z.array(z.string().min(1).max(64)).max(MAX_LIST_LENGTH),
  onChainDivergenceThresholdPercent: z.number().finite().min(0).max(100),
  dashboardView: z.enum(['card', 'table']),
  cardOrder: z.array(z.string().min(1).max(64)).max(MAX_LIST_LENGTH),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  largeText: z.boolean(),
  rtlEnabled: z.boolean(),
  chartTimezone: z.enum(['UTC', 'Local', 'America/New_York', 'Europe/London', 'Asia/Tokyo']),
  formatLocale: z.enum(['auto', 'en-US', 'de-DE', 'fr-FR', 'ja-JP', 'es-ES', 'ar-SA', 'he', 'pt-BR']),
  showExcludedSources: z.boolean(),
})

/**
 * Upgrade functions keyed by the version they start from. Version 1 is the
 * first published format, so there is nothing to upgrade yet; add an entry
 * here, and bump `PREFERENCES_SCHEMA_VERSION`, when the shape changes.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

const envelopeSchema = z.object({
  format: z.literal(PREFERENCES_FORMAT),
  schemaVersion: z.number().int().min(1),
  preferences: z.record(z.string(), z.unknown()),
})

export interface PreferencesExport {
  format: typeof PREFERENCES_FORMAT
  schemaVersion: number
  exportedAt: string
  preferences: PortablePreferences
}

export type ImportResult = { ok: true; preferences: PortablePreferences } | { ok: false; error: string }

/** Serialise the portable subset of `preferences` into a versioned envelope. */
export function exportPreferences(preferences: Preferences, exportedAt: Date = new Date()): string {
  const portable = {} as Record<string, unknown>
  for (const key of PORTABLE_KEYS) portable[key] = preferences[key]

  const envelope: PreferencesExport = {
    format: PREFERENCES_FORMAT,
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    preferences: portable as PortablePreferences,
  }
  return JSON.stringify(envelope, null, 2)
}

/** Parse and validate text produced by {@link exportPreferences}. Never throws. */
export function importPreferences(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' }
  }

  const envelope = envelopeSchema.safeParse(parsed)
  if (!envelope.success) {
    return { ok: false, error: 'The file is not a preferences export.' }
  }

  const { schemaVersion } = envelope.data
  if (schemaVersion > PREFERENCES_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This file uses preferences format v${schemaVersion}, but this version of the app reads up to v${PREFERENCES_SCHEMA_VERSION}.`,
    }
  }

  let raw: Record<string, unknown> = envelope.data.preferences
  for (let version = schemaVersion; version < PREFERENCES_SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version]
    if (migrate) raw = migrate(raw)
  }

  const result = portableSchemaV1.safeParse(raw)
  if (!result.success) {
    const fields = Array.from(new Set(result.error.issues.map((issue) => String(issue.path[0] ?? 'unknown'))))
    return { ok: false, error: `Invalid preference values: ${fields.join(', ')}.` }
  }

  return { ok: true, preferences: result.data }
}
