import { z } from 'zod';
import { feedSchema, feedSchemaV1, feedSchemaV2 } from './schemas';

/**
 * Feed schema evolution governance (#667).
 *
 * Feed payloads are validated by the schemas in `./schemas` (#595), but schema
 * *changes* were previously unmanaged: a new field or a tightened type could
 * break clients silently, and version negotiation (#619) had no change policy
 * behind it. This module adds that policy:
 *
 *  - a compatibility checker that classifies a schema change as additive
 *    (pass) or breaking (requires a version bump),
 *  - fixture generation from each schema version so consumers can be run
 *    against every supported version,
 *  - a per-version changelog recording the compatibility verdict,
 *  - a CI gate that fails on an un-bumped breaking change.
 */

/** A single supported feed schema version. */
export interface FeedSchemaVersion {
  /** Semver-ish version string, e.g. "1.0.0". */
  version: string;
  /** The zod schema validating payloads for this version. */
  schema: z.ZodTypeAny;
}

/**
 * The ordered list of supported feed schema versions. New versions are appended
 * here; the last entry is the current version.
 */
export const SUPPORTED_FEED_SCHEMAS: FeedSchemaVersion[] = [
  { version: '1.0.0', schema: feedSchemaV1 },
  { version: '2.0.0', schema: feedSchemaV2 },
];

/** The current (latest) feed schema version. */
export const CURRENT_FEED_VERSION =
  SUPPORTED_FEED_SCHEMAS[SUPPORTED_FEED_SCHEMAS.length - 1].version;

/** The default feed schema, re-exported for consumers. */
export const currentFeedSchema = feedSchema;

export type ChangeKind = 'additive' | 'breaking';

export interface FieldChange {
  path: string;
  kind: ChangeKind;
  detail: string;
}

export interface CompatibilityVerdict {
  from: string;
  to: string;
  compatible: boolean;
  changes: FieldChange[];
}

/**
 * Minimal structural description of a schema used for comparison. We derive it
 * from the zod schema's shape so the checker does not depend on zod internals
 * beyond `_def`/`shape`, which are stable enough for governance purposes.
 */
interface FieldShape {
  type: string;
  optional: boolean;
}

type ShapeMap = Record<string, FieldShape>;

function describeType(schema: z.ZodTypeAny): string {
  const def = (schema as unknown as { _def?: { typeName?: string } })._def;
  return def?.typeName ?? 'unknown';
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const type = describeType(schema);
  return type === 'ZodOptional' || type === 'ZodDefault';
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  const type = describeType(schema);
  if (type === 'ZodOptional' || type === 'ZodDefault') {
    const inner = (schema as unknown as { _def?: { innerType?: z.ZodTypeAny } })._def
      ?.innerType;
    return inner ? unwrap(inner) : schema;
  }
  return schema;
}

/** Extract a flat field shape map from an object schema. */
export function extractShape(schema: z.ZodTypeAny): ShapeMap {
  const shape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> })
    .shape;
  if (!shape) return {};
  const out: ShapeMap = {};
  for (const [key, value] of Object.entries(shape)) {
    out[key] = {
      type: describeType(unwrap(value)),
      optional: isOptional(value),
    };
  }
  return out;
}

/**
 * Classify the change between two schema versions.
 *
 * Additive (compatible) changes:
 *  - a new optional field is added
 *
 * Breaking changes (require a version bump):
 *  - a field is removed
 *  - a field's type changes
 *  - an optional field becomes required
 *  - a new required field is added
 */
export function checkCompatibility(
  from: FeedSchemaVersion,
  to: FeedSchemaVersion,
): CompatibilityVerdict {
  const before = extractShape(from.schema);
  const after = extractShape(to.schema);
  const changes: FieldChange[] = [];

  for (const [path, prev] of Object.entries(before)) {
    const next = after[path];
    if (!next) {
      changes.push({
        path,
        kind: 'breaking',
        detail: `field removed in ${to.version}`,
      });
      continue;
    }
    if (prev.type !== next.type) {
      changes.push({
        path,
        kind: 'breaking',
        detail: `type changed from ${prev.type} to ${next.type}`,
      });
      continue;
    }
    if (prev.optional && !next.optional) {
      changes.push({
        path,
        kind: 'breaking',
        detail: 'field became required',
      });
    }
  }

  for (const [path, next] of Object.entries(after)) {
    if (before[path]) continue;
    if (next.optional) {
      changes.push({
        path,
        kind: 'additive',
        detail: `optional field added in ${to.version}`,
      });
    } else {
      changes.push({
        path,
        kind: 'breaking',
        detail: `required field added in ${to.version}`,
      });
    }
  }

  return {
    from: from.version,
    to: to.version,
    compatible: changes.every((c) => c.kind === 'additive'),
    changes,
  };
}

/**
 * Verify that a breaking change was accompanied by a version bump. A breaking
 * change between two *different* versions is allowed; a breaking change that
 * keeps the same version string is an un-bumped breaking change and fails CI.
 */
export function assertVersionBump(
  from: FeedSchemaVersion,
  to: FeedSchemaVersion,
): CompatibilityVerdict {
  const verdict = checkCompatibility(from, to);
  if (!verdict.compatible && from.version === to.version) {
    throw new Error(
      `Breaking feed schema change without a version bump (${from.version}): ` +
        verdict.changes
          .filter((c) => c.kind === 'breaking')
          .map((c) => `${c.path} (${c.detail})`)
          .join(', '),
    );
  }
  return verdict;
}

/**
 * Run the compatibility gate across every consecutive pair of supported
 * versions. Throws on the first un-bumped breaking change so CI fails.
 */
export function runCompatibilityGate(
  versions: FeedSchemaVersion[] = SUPPORTED_FEED_SCHEMAS,
): CompatibilityVerdict[] {
  const verdicts: CompatibilityVerdict[] = [];
  for (let i = 1; i < versions.length; i += 1) {
    verdicts.push(assertVersionBump(versions[i - 1], versions[i]));
  }
  return verdicts;
}

/** A generated consumer fixture for a schema version. */
export interface ConsumerFixture {
  version: string;
  payload: Record<string, unknown>;
}

/**
 * Generate a minimal valid payload for a schema version by walking its shape.
 * Consumers are run against these fixtures for every supported version.
 */
export function generateFixture(entry: FeedSchemaVersion): ConsumerFixture {
  const shape = extractShape(entry.schema);
  const payload: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(shape)) {
    if (field.optional) continue;
    payload[key] = sampleValue(field.type);
  }
  return { version: entry.version, payload };
}

function sampleValue(type: string): unknown {
  switch (type) {
    case 'ZodString':
      return 'sample';
    case 'ZodNumber':
      return 0;
    case 'ZodBoolean':
      return false;
    case 'ZodArray':
      return [];
    case 'ZodObject':
      return {};
    default:
      return null;
  }
}

/** Generate fixtures for every supported schema version. */
export function generateFixtures(
  versions: FeedSchemaVersion[] = SUPPORTED_FEED_SCHEMAS,
): ConsumerFixture[] {
  return versions.map(generateFixture);
}

/**
 * Run a consumer against every supported schema version's fixture. The consumer
 * receives the fixture payload and the version it targets; a thrown error
 * fails the run.
 */
export function runConsumersAgainstAllVersions(
  consumer: (fixture: ConsumerFixture) => void,
  versions: FeedSchemaVersion[] = SUPPORTED_FEED_SCHEMAS,
): void {
  for (const fixture of generateFixtures(versions)) {
    consumer(fixture);
  }
}

/** A single changelog entry recording a version's compatibility verdict. */
export interface ChangelogEntry {
  version: string;
  compatible: boolean;
  changes: FieldChange[];
}

/**
 * Build the changelog from the supported versions: each version records the
 * verdict of the change that introduced it (the first version is trivially
 * compatible).
 */
export function buildChangelog(
  versions: FeedSchemaVersion[] = SUPPORTED_FEED_SCHEMAS,
): ChangelogEntry[] {
  return versions.map((entry, index) => {
    if (index === 0) {
      return { version: entry.version, compatible: true, changes: [] };
    }
    const verdict = checkCompatibility(versions[index - 1], entry);
    return {
      version: entry.version,
      compatible: verdict.compatible,
      changes: verdict.changes,
    };
  });
}
