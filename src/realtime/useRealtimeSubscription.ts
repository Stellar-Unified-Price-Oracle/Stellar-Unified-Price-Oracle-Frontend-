import { useEffect, useRef } from 'react';
import type { RealtimeSubscriptionOptions } from '../types/realtime';

/**
 * Centralized, ref-counted realtime subscription registry.
 *
 * A given pair (channel/topic) is subscribed exactly once and only released
 * when the last consumer leaves. This prevents rapid navigation from leaking
 * subscriptions or dropping one that is still in use.
 *
 * Non-essential subscriptions are paused while the tab is hidden and resumed
 * with a resync on focus. Critical alerting subscriptions (#603) are never
 * paused by visibility changes.
 */

type Unsubscribe = () => void;

type SubscribeFn = (options: RealtimeSubscriptionOptions) => Unsubscribe;

type Entry = {
  key: string;
  options: RealtimeSubscriptionOptions;
  refCount: number;
  unsubscribe: Unsubscribe | null;
  paused: boolean;
};

const registry = new Map<string, Entry>();

let visibilityBound = false;

function keyFor(options: RealtimeSubscriptionOptions): string {
  return options.topic ?? options.channel ?? options.pair ?? '';
}

function isEssential(options: RealtimeSubscriptionOptions): boolean {
  // Critical alerting subscriptions (#603) must never be paused.
  return options.essential === true || options.critical === true;
}

function openEntry(entry: Entry): void {
  if (entry.unsubscribe) return;
  entry.unsubscribe = subscribeImpl(entry.options);
  entry.paused = false;
}

function closeEntry(entry: Entry): void {
  if (!entry.unsubscribe) return;
  entry.unsubscribe();
  entry.unsubscribe = null;
  entry.paused = false;
}

function pauseEntry(entry: Entry): void {
  if (entry.paused || !entry.unsubscribe) return;
  if (isEssential(entry.options)) return;
  entry.unsubscribe();
  entry.unsubscribe = null;
  entry.paused = true;
}

function resumeEntry(entry: Entry): void {
  if (!entry.paused) return;
  openEntry(entry);
  entry.options.onResync?.();
}

function handleVisibilityChange(): void {
  const hidden = typeof document !== 'undefined' && document.hidden;
  for (const entry of registry.values()) {
    if (hidden) {
      pauseEntry(entry);
    } else {
      resumeEntry(entry);
    }
  }
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityBound = true;
}

function unbindVisibility(): void {
  if (!visibilityBound || typeof document === 'undefined') return;
  if (registry.size > 0) return;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  visibilityBound = false;
}

/**
 * The single owner of the underlying transport subscription. Swapped out in
 * tests via {@link setSubscribeImpl} so a leak test can assert zero live
 * subscriptions after teardown.
 */
let subscribeImpl: SubscribeFn = () => () => {};

export function setSubscribeImpl(fn: SubscribeFn): void {
  subscribeImpl = fn;
}

/**
 * Acquire a ref-counted subscription for the given pair. Returns a release
 * function; the underlying subscription is torn down only when the last
 * consumer releases it.
 */
export function acquireSubscription(options: RealtimeSubscriptionOptions): Unsubscribe {
  const key = keyFor(options);
  let entry = registry.get(key);

  if (!entry) {
    entry = { key, options, refCount: 0, unsubscribe: null, paused: false };
    registry.set(key, entry);
  } else {
    // Keep the freshest options (e.g. updated resync handler).
    entry.options = options;
  }

  entry.refCount += 1;
  bindVisibility();

  const hidden = typeof document !== 'undefined' && document.hidden;
  if (hidden && !isEssential(options)) {
    entry.paused = true;
  } else {
    openEntry(entry);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const current = registry.get(key);
    if (!current) return;

    current.refCount -= 1;
    if (current.refCount <= 0) {
      closeEntry(current);
      registry.delete(key);
      unbindVisibility();
    }
  };
}

/** Test/introspection helper: number of live underlying subscriptions. */
export function activeSubscriptionCount(): number {
  let count = 0;
  for (const entry of registry.values()) {
    if (entry.unsubscribe) count += 1;
  }
  return count;
}

/** Test helper: number of tracked pairs (including paused ones). */
export function trackedPairCount(): number {
  return registry.size;
}

/**
 * React hook wrapper around the ref-counted registry. Subscribes on mount and
 * guarantees teardown on unmount / route change.
 */
export function useRealtimeSubscription(options: RealtimeSubscriptionOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const key = keyFor(options);

  useEffect(() => {
    const release = acquireSubscription(optionsRef.current);
    return release;
  }, [key]);
}
