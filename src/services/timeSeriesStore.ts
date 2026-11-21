import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface VerifiedProofRecord {
  id: string;
  pair: string;
  ledger: number;
  result: boolean;
  verifiedAt: number;
}

interface TimeSeriesDB extends DBSchema {
  series: {
    key: string;
    value: {
      key: string;
      points: TimeSeriesPoint[];
    };
  };
  verifiedProofs: {
    key: string;
    value: VerifiedProofRecord;
    indexes: { 'by-verifiedAt': number };
  };
}

const DB_NAME = 'handsoff-time-series';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<TimeSeriesDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TimeSeriesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TimeSeriesDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('series', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          const store = db.createObjectStore('verifiedProofs', {
            keyPath: 'id',
          });
          store.createIndex('by-verifiedAt', 'verifiedAt');
        }
      },
    });
  }
  return dbPromise;
}

export async function appendPoint(
  key: string,
  point: TimeSeriesPoint,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('series', key);
  const points = existing ? existing.points : [];
  points.push(point);
  await db.put('series', { key, points });
}

export async function getSeries(key: string): Promise<TimeSeriesPoint[]> {
  const db = await getDB();
  const record = await db.get('series', key);
  return record ? record.points : [];
}

export async function recordVerifiedProof(
  proof: Omit<VerifiedProofRecord, 'id' | 'verifiedAt'> & {
    id?: string;
    verifiedAt?: number;
  },
): Promise<VerifiedProofRecord> {
  const db = await getDB();
  const record: VerifiedProofRecord = {
    id: proof.id ?? `${proof.pair}:${proof.ledger}:${Date.now()}`,
    pair: proof.pair,
    ledger: proof.ledger,
    result: proof.result,
    verifiedAt: proof.verifiedAt ?? Date.now(),
  };
  await db.put('verifiedProofs', record);
  return record;
}

export async function getVerifiedProofs(): Promise<VerifiedProofRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('verifiedProofs', 'by-verifiedAt');
}

export async function clearVerifiedProofs(): Promise<void> {
  const db = await getDB();
  await db.clear('verifiedProofs');
}

export async function exportVerifiedProofs(): Promise<string> {
  const proofs = await getVerifiedProofs();
  return JSON.stringify(proofs, null, 2);
}
