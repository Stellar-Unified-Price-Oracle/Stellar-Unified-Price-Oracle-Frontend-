import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WsLeaderElection, type WsLeaderElectionCallbacks } from './wsLeaderElection'

// ── BroadcastChannel mock ────────────────────────────────────────────────────

/**
 * In-process BroadcastChannel simulation: all instances on the same channel
 * name share messages (excluding the sender).
 */
class FakeBroadcastChannel {
  static channels: Map<string, Set<FakeBroadcastChannel>> = new Map()

  name: string
  onmessage: ((e: { data: unknown }) => void) | null = null
  closed = false

  constructor(name: string) {
    this.name = name
    if (!FakeBroadcastChannel.channels.has(name)) {
      FakeBroadcastChannel.channels.set(name, new Set())
    }
    FakeBroadcastChannel.channels.get(name)!.add(this)
  }

  postMessage(data: unknown): void {
    if (this.closed) return
    // Real BroadcastChannel delivers messages asynchronously — a tab that
    // posts and immediately closes its channel must not observe the message
    // round-trip. Model that with a (faked) timer; tests flush with
    // `vi.advanceTimersByTime(0)`.
    const peers = FakeBroadcastChannel.channels.get(this.name)
    peers?.forEach((ch) => {
      if (ch !== this && !ch.closed) {
        setTimeout(() => {
          if (!ch.closed) {
            ch.onmessage?.({ data })
          }
        }, 0)
      }
    })
  }

  close(): void {
    this.closed = true
    FakeBroadcastChannel.channels.get(this.name)?.delete(this)
  }

  static reset(): void {
    this.channels.clear()
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  FakeBroadcastChannel.reset()
  // Inject fake BroadcastChannel into global scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).BroadcastChannel = FakeBroadcastChannel

  // Each test gets fresh sessionStorage
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).BroadcastChannel
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCbs(overrides: Partial<WsLeaderElectionCallbacks> = {}): WsLeaderElectionCallbacks {
  return {
    onBecomeLeader: vi.fn(),
    onBecomeFollower: vi.fn(),
    onFollowerMessage: vi.fn(),
    onLeaderFallback: vi.fn(),
    ...overrides,
  }
}

/**
 * Constructs a WsLeaderElection simulating a *new browser tab*. In a real
 * browser each tab has its own sessionStorage, so each instance gets a fresh
 * tabId. jsdom shares one sessionStorage, so without clearing the stored id
 * every instance reuses the same tabId and the module filters its own messages
 * as "self" — breaking the two-tab protocol tests.
 */
function newTab(cbs: WsLeaderElectionCallbacks): WsLeaderElection {
  sessionStorage.removeItem('__supo_tab_id__')
  return new WsLeaderElection(cbs)
}

/**
 * Flush queued BroadcastChannel deliveries. Messages trigger handler chains
 * (e.g. CLAIM → ACK) where the reply is scheduled *inside* the first delivery
 * callback, and `advanceTimersByTime(0)` does not re-fire timers scheduled at
 * the same timestamp during a callback. Advancing by 1ms per hop lets each
 * queued delivery run in turn; 10 hops is far more than any chain needs.
 */
function flushMessages(): void {
  for (let i = 0; i < 10; i++) {
    vi.advanceTimersByTime(1)
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WsLeaderElection', () => {
  describe('single tab', () => {
    it('becomes leader when no other tab responds within the claim timeout', () => {
      const cbs = makeCbs()
      const election = new WsLeaderElection(cbs)
      election.start()

      // Advance past the claim timeout
      vi.advanceTimersByTime(300)

      expect(cbs.onBecomeLeader).toHaveBeenCalledTimes(1)
      expect(cbs.onBecomeFollower).not.toHaveBeenCalled()

      election.destroy()
    })

    it('isLeader returns true after winning the election', () => {
      const election = new WsLeaderElection(makeCbs())
      election.start()
      vi.advanceTimersByTime(300)

      expect(election.isLeader).toBe(true)

      election.destroy()
    })

    it('isFallback returns false when BroadcastChannel is available', () => {
      const election = new WsLeaderElection(makeCbs())
      election.start()

      expect(election.isFallback).toBe(false)

      election.destroy()
    })
  })

  describe('two tabs', () => {
    it('second tab becomes follower when first tab is already leader', () => {
      const cbs1 = makeCbs()
      const cbs2 = makeCbs()

      const e1 = newTab(cbs1)
      e1.start()
      // Tab 1 wins election
      vi.advanceTimersByTime(300)
      expect(cbs1.onBecomeLeader).toHaveBeenCalledTimes(1)

      // Tab 2 starts — receives ACK from Tab 1 (delivered on the next tick)
      const e2 = newTab(cbs2)
      e2.start()
      flushMessages()

      expect(cbs2.onBecomeFollower).toHaveBeenCalledTimes(1)
      expect(cbs2.onBecomeLeader).not.toHaveBeenCalled()

      e1.destroy()
      e2.destroy()
    })

    it('follower becomes leader when leader resigns', () => {
      const cbs1 = makeCbs()
      const cbs2 = makeCbs()

      const e1 = newTab(cbs1)
      e1.start()
      vi.advanceTimersByTime(300)

      const e2 = newTab(cbs2)
      e2.start()
      flushMessages()

      // Leader resigns (tab closes). e1's channel is closed by the time e2
      // processes RESIGN, so e2's re-claim goes unanswered and it wins.
      e1.destroy()
      // Flush RESIGN delivery, then advance past the claim timeout
      flushMessages()
      vi.advanceTimersByTime(300)

      expect(cbs2.onBecomeLeader).toHaveBeenCalledTimes(1)

      e2.destroy()
    })

    it('follower becomes leader when leader heartbeat times out', () => {
      const cbs1 = makeCbs()
      const cbs2 = makeCbs()

      const e1 = newTab(cbs1)
      e1.start()
      vi.advanceTimersByTime(300)

      const e2 = newTab(cbs2)
      e2.start()
      flushMessages()

      // Heartbeat fires at 2s intervals; after 6s without any heartbeat follower takes over
      // Destroy without calling RESIGN (simulates unresponsive tab)
      if ((e1 as unknown as { state: string }).state) {
        // Force-close without triggering RESIGN
        const channel = (e1 as unknown as { channel: FakeBroadcastChannel }).channel
        channel?.close()
        clearInterval((e1 as unknown as { heartbeatTimer: ReturnType<typeof setInterval> }).heartbeatTimer ?? undefined)
      }

      // Advance past LEADER_TIMEOUT_MS (6s) + CLAIM_TIMEOUT_MS (200ms)
      vi.advanceTimersByTime(7000)

      expect(cbs2.onBecomeLeader).toHaveBeenCalledTimes(1)

      e1.destroy()
      e2.destroy()
    })

    it('follower receives relayed price updates', () => {
      const cbs1 = makeCbs()
      const cbs2 = makeCbs()

      const e1 = newTab(cbs1)
      e1.start()
      vi.advanceTimersByTime(300)

      const e2 = newTab(cbs2)
      e2.start()
      flushMessages()

      const msg = {
        type: 'price_update' as const,
        assetPair: 'BTC/USD',
        price: 50000,
        timestamp: Date.now(),
        confidence: 0.99,
        sources: ['chainlink'],
      }

      e1.relayMessage(msg)
      // RELAY is delivered on the next tick
      flushMessages()

      expect(cbs2.onFollowerMessage).toHaveBeenCalledWith(msg)

      e1.destroy()
      e2.destroy()
    })

    it('relayMessage is a no-op when called on a follower', () => {
      const cbs1 = makeCbs()
      const cbs2 = makeCbs()

      const e1 = newTab(cbs1)
      e1.start()
      vi.advanceTimersByTime(300)

      const e2 = newTab(cbs2)
      e2.start()
      flushMessages()

      // Follower tries to relay — should be silently ignored
      e2.relayMessage({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50000,
        timestamp: Date.now(),
        confidence: 0.99,
        sources: ['chainlink'],
      })

      // Only followers get onFollowerMessage; here cbs1 is the leader so no relay to it
      expect(cbs1.onFollowerMessage).not.toHaveBeenCalled()

      e1.destroy()
      e2.destroy()
    })
  })

  describe('fallback (BroadcastChannel unavailable)', () => {
    it('calls onLeaderFallback when BroadcastChannel is not defined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).BroadcastChannel

      const cbs = makeCbs()
      const election = new WsLeaderElection(cbs)
      election.start()

      expect(cbs.onLeaderFallback).toHaveBeenCalledTimes(1)
      expect(cbs.onBecomeLeader).not.toHaveBeenCalled()
      expect(election.isFallback).toBe(true)

      election.destroy()
    })
  })

  describe('lifecycle', () => {
    it('destroy is idempotent', () => {
      const election = new WsLeaderElection(makeCbs())
      election.start()
      vi.advanceTimersByTime(300)

      expect(() => {
        election.destroy()
        election.destroy()
      }).not.toThrow()
    })

    it('start is idempotent — calling twice does nothing extra', () => {
      const cbs = makeCbs()
      const election = new WsLeaderElection(cbs)
      election.start()
      election.start() // second call ignored

      vi.advanceTimersByTime(300)

      expect(cbs.onBecomeLeader).toHaveBeenCalledTimes(1)

      election.destroy()
    })
  })
})
