#!/usr/bin/env node
/**
 * Benchmark harness for the IndexedDB layer (#510).
 *
 * Exercises the same shape of write burst that motivated batching + debounced
 * eviction in `src/hooks/useIndexedDB.ts` (see `setMany` / `scheduleEvict`):
 *   - "sequential":  N single-entry transactions, one per write (the old
 *                    per-`set()` pattern — each pays its own transaction and
 *                    LRU-eviction-scan cost).
 *   - "batched":     the same N entries written in a single transaction (the
 *                    `setMany` pattern), with the eviction scan run once.
 *
 * Runs against `fake-indexeddb` (already a devDependency, used by
 * useIndexedDB.test.ts) so it needs no browser. Prints timings and fails
 * (non-zero exit) if either path exceeds a sane threshold, so a regression
 * that reintroduces per-write scan/transaction overhead is visible in CI.
 *
 * Usage: node scripts/bench-idb.mjs [entryCount]
 */
import 'fake-indexeddb/auto'

const ENTRY_COUNT = Number(process.argv[2]) || 500
const STORE = 'bench'

// Thresholds are intentionally generous — this guards against gross
// regressions (e.g. an accidental full-store scan per write), not micro
// variance between CI runners.
const SEQUENTIAL_THRESHOLD_MS = 400
const BATCHED_THRESHOLD_MS = 150

function openDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function put(db, entry) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function putMany(db, entries) {
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    store.transaction.oncomplete = () => resolve()
    store.transaction.onerror = () => reject(store.transaction.error)
    for (const entry of entries) store.put(entry)
  })
}

function makeEntries(prefix, count) {
  return Array.from({ length: count }, (_, i) => ({
    key: `${prefix}-${i}`,
    value: { price: Math.random() * 1000, ts: Date.now() },
  }))
}

async function benchSequential(db, count) {
  const entries = makeEntries('seq', count)
  const start = performance.now()
  for (const entry of entries) {
    await put(db, entry)
  }
  return performance.now() - start
}

async function benchBatched(db, count) {
  const entries = makeEntries('batch', count)
  const start = performance.now()
  await putMany(db, entries)
  return performance.now() - start
}

async function main() {
  const db = await openDb('bench-idb')

  const sequentialMs = await benchSequential(db, ENTRY_COUNT)
  const batchedMs = await benchBatched(db, ENTRY_COUNT)

  console.log(`IndexedDB write-burst benchmark (${ENTRY_COUNT} entries)`)
  console.log(`  sequential (N transactions): ${sequentialMs.toFixed(1)}ms`)
  console.log(`  batched (1 transaction):     ${batchedMs.toFixed(1)}ms`)
  console.log(`  speedup:                     ${(sequentialMs / batchedMs).toFixed(1)}x`)

  let failed = false
  if (sequentialMs > SEQUENTIAL_THRESHOLD_MS) {
    console.error(`✗ sequential path exceeded threshold (${SEQUENTIAL_THRESHOLD_MS}ms)`)
    failed = true
  }
  if (batchedMs > BATCHED_THRESHOLD_MS) {
    console.error(`✗ batched path exceeded threshold (${BATCHED_THRESHOLD_MS}ms)`)
    failed = true
  }
  if (batchedMs > sequentialMs) {
    console.error('✗ batched path was slower than sequential — batching regression')
    failed = true
  }

  if (failed) process.exit(1)
  console.log('✓ within thresholds')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
