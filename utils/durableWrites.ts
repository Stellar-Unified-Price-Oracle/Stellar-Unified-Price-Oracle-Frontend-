export type DurableWriteStatus = 'pending' | 'flushed' | 'dropped';

export interface DurableWriteRecord {
  key: string;
  value: unknown;
  version: number;
  attempts: number;
  status: DurableWriteStatus;
  updatedAt: number;
}

export interface DurableWriteStore {
  get(key: string): DurableWriteRecord | undefined;
  set(key: string, record: DurableWriteRecord): void;
  delete(key: string): void;
  entries(): DurableWriteRecord[];
}

export interface DurableWriteOptions {
  store?: DurableWriteStore;
  now?: () => number;
  serialize?: (value: unknown) => string;
}

export interface DurableWriteResult {
  ok: boolean;
  record: DurableWriteRecord;
  error?: unknown;
}

export type DurableWriteFn = (value: unknown) => Promise<void> | void;

/**
 * Safely serialize a value, tolerating circular structures.
 * Falls back to a best-effort representation instead of throwing.
 */
export function safeSerialize(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val as object)) {
          return '[Circular]';
        }
        seen.add(val as object);
      }
      return val;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  }
}

function createMemoryStore(): DurableWriteStore {
  const map = new Map<string, DurableWriteRecord>();
  return {
    get: (key) => map.get(key),
    set: (key, record) => {
      map.set(key, record);
    },
    delete: (key) => {
      map.delete(key);
    },
    entries: () => Array.from(map.values()),
  };
}

export class DurableWrites {
  private readonly store: DurableWriteStore;
  private readonly now: () => number;
  private readonly serialize: (value: unknown) => string;
  private versionCounter = 0;

  constructor(options: DurableWriteOptions = {}) {
    this.store = options.store ?? createMemoryStore();
    this.now = options.now ?? (() => Date.now());
    this.serialize = options.serialize ?? safeSerialize;
  }

  private nextVersion(): number {
    this.versionCounter += 1;
    return this.versionCounter;
  }

  /**
   * Attempt to write a value. On success the record is marked flushed and any
   * older queued write for the same key is dropped. On failure the write stays
   * queued with its attempt counter persisted.
   */
  async write(key: string, value: unknown, fn: DurableWriteFn): Promise<DurableWriteResult> {
    // Ensure the value is serializable up front so circular structures do not
    // throw later during persistence.
    this.serialize(value);

    const version = this.nextVersion();
    const existing = this.store.get(key);
    const attempts = (existing?.attempts ?? 0) + 1;

    const record: DurableWriteRecord = {
      key,
      value,
      version,
      attempts,
      status: 'pending',
      updatedAt: this.now(),
    };
    this.store.set(key, record);

    try {
      await fn(value);
      const flushed: DurableWriteRecord = {
        ...record,
        status: 'flushed',
        updatedAt: this.now(),
      };
      this.store.set(key, flushed);
      return { ok: true, record: flushed };
    } catch (error) {
      const failed: DurableWriteRecord = {
        ...record,
        status: 'pending',
        updatedAt: this.now(),
      };
      this.store.set(key, failed);
      return { ok: false, record: failed, error };
    }
  }

  /**
   * Flush all pending writes. A queued write is dropped if a newer write for
   * the same key has already succeeded, so a stale queued write can never
   * clobber a later successful one.
   */
  async flush(fn: DurableWriteFn): Promise<DurableWriteResult[]> {
    const results: DurableWriteResult[] = [];
    const pending = this.store
      .entries()
      .filter((record) => record.status === 'pending')
      .sort((a, b) => a.version - b.version);

    for (const record of pending) {
      const current = this.store.get(record.key);
      if (!current) {
        continue;
      }
      // A newer write for this key already succeeded; drop the stale one.
      if (current.status === 'flushed' && current.version > record.version) {
        const dropped: DurableWriteRecord = {
          ...record,
          status: 'dropped',
          updatedAt: this.now(),
        };
        this.store.set(record.key, dropped);
        results.push({ ok: true, record: dropped });
        continue;
      }

      const attempts = record.attempts + 1;
      const attemptRecord: DurableWriteRecord = {
        ...record,
        attempts,
        updatedAt: this.now(),
      };
      this.store.set(record.key, attemptRecord);

      try {
        await fn(record.value);
        const flushed: DurableWriteRecord = {
          ...attemptRecord,
          status: 'flushed',
          updatedAt: this.now(),
        };
        this.store.set(record.key, flushed);
        results.push({ ok: true, record: flushed });
      } catch (error) {
        const failed: DurableWriteRecord = {
          ...attemptRecord,
          status: 'pending',
          updatedAt: this.now(),
        };
        this.store.set(record.key, failed);
        results.push({ ok: false, record: failed, error });
      }
    }

    return results;
  }

  get(key: string): DurableWriteRecord | undefined {
    return this.store.get(key);
  }

  pending(): DurableWriteRecord[] {
    return this.store.entries().filter((record) => record.status === 'pending');
  }
}

export function createDurableWrites(options: DurableWriteOptions = {}): DurableWrites {
  return new DurableWrites(options);
}
