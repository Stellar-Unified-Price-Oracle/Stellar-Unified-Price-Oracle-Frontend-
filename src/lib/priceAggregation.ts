import type { Tick } from '../types';

export interface PriceAggregate {
  value: number;
  strategy: string;
  lineage: LineageRecord;
}

export interface LineageRecord {
  id: string;
  aggregateValue: number;
  strategy: string;
  contributingTicks: LineageTick[];
  weights: number[];
  exclusions: LineageExclusion[];
  createdAt: number;
}

export interface LineageTick {
  tickId: string;
  source: string;
  price: number;
  timestamp: number;
}

export interface LineageExclusion {
  tickId: string;
  reason: string;
}

/**
 * Lineage retention policy: records are kept in a bounded ring buffer.
 * MAX_LINEAGE_RECORDS bounds memory; older records are evicted FIFO.
 * Records contain only market data (tick ids, sources, prices, timestamps)
 * and never include user identifiers or account data.
 */
export const MAX_LINEAGE_RECORDS = 500;

const lineageStore: LineageRecord[] = [];

function recordLineage(record: LineageRecord): void {
  lineageStore.push(record);
  while (lineageStore.length > MAX_LINEAGE_RECORDS) {
    lineageStore.shift();
  }
}

export function getLineage(id: string): LineageRecord | undefined {
  return lineageStore.find((r) => r.id === id);
}

export function getLineageStore(): readonly LineageRecord[] {
  return lineageStore;
}

function makeLineageId(strategy: string, ticks: LineageTick[]): string {
  const parts = ticks.map((t) => `${t.tickId}:${t.price}`).join('|');
  return `${strategy}#${parts}`;
}

/**
 * Aggregate ticks into a price while recording a full lineage record.
 * Excluded ticks (invalid price, stale, or duplicate) are captured with a reason.
 */
export function aggregateWithLineage(
  ticks: Tick[],
  strategy: string,
  now: number = Date.now(),
): PriceAggregate {
  const contributingTicks: LineageTick[] = [];
  const weights: number[] = [];
  const exclusions: LineageExclusion[] = [];
  const seen = new Set<string>();

  for (const tick of ticks) {
    if (!Number.isFinite(tick.price) || tick.price <= 0) {
      exclusions.push({ tickId: tick.id, reason: 'invalid-price' });
      continue;
    }
    if (seen.has(tick.id)) {
      exclusions.push({ tickId: tick.id, reason: 'duplicate' });
      continue;
    }
    seen.add(tick.id);
    contributingTicks.push({
      tickId: tick.id,
      source: tick.source,
      price: tick.price,
      timestamp: tick.timestamp,
    });
    weights.push(1);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const value =
    totalWeight === 0
      ? 0
      : contributingTicks.reduce((sum, t, i) => sum + t.price * weights[i], 0) /
        totalWeight;

  const record: LineageRecord = {
    id: makeLineageId(strategy, contributingTicks),
    aggregateValue: value,
    strategy,
    contributingTicks,
    weights,
    exclusions,
    createdAt: now,
  };

  recordLineage(record);

  return { value, strategy, lineage: record };
}

/**
 * Replay a lineage record to reproduce the aggregate exactly.
 * Deterministic: same inputs, weights, and strategy yield the same value.
 */
export function replayLineage(record: LineageRecord): number {
  const totalWeight = record.weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  return (
    record.contributingTicks.reduce(
      (sum, t, i) => sum + t.price * record.weights[i],
      0,
    ) / totalWeight
  );
}

/**
 * Export a lineage record as a privacy-safe JSON string.
 * Contains only market data; no user identifiers.
 */
export function exportLineage(record: LineageRecord): string {
  return JSON.stringify(record, null, 2);
}
