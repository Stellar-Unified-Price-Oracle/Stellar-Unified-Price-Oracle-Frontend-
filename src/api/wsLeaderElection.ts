/**
 * WebSocket Leader Election via BroadcastChannel
 *
 * ## Problem
 * When a user opens multiple tabs every tab creates its own WebSocket connection
 * to /ws, multiplying server load and duplicating traffic.
 *
 * ## Solution
 * This module implements a lightweight leader-election protocol over the
 * BroadcastChannel API so only **one** tab keeps an active WebSocket at a time:
 *
 * 1. On startup each tab broadcasts a `CLAIM` and starts a claim timeout.
 * 2. If another tab ACKs the claim, the claimant becomes a follower.
 * 3. The elected leader opens the real WebSocket and relays `price_update`
 *    messages over the channel to all followers.
 * 4. The leader sends a `HEARTBEAT` every {@link HEARTBEAT_INTERVAL_MS} ms.
 * 5. Followers that have not seen a heartbeat for {@link LEADER_TIMEOUT_MS} ms
 *    trigger a new election (claim round).
 * 6. When BroadcastChannel is unavailable the module falls back transparently
 *    to `fallback` mode — the caller uses its own WebSocket as normal.
 *
 * ## Memory & cleanup
 * All timers are stored in instance fields and cleared on {@link WsLeaderElection.destroy}.
 * The BroadcastChannel is closed on destroy.  No globals are leaked.
 *
 * ## Usage
 * ```ts
 * const election = new WsLeaderElection({
 *   onBecomeLeader: () => openSocket(),
 *   onBecomeFollower: () => closeSocket(),
 *   onFollowerMessage: (msg) => handlePriceUpdate(msg),
 *   onLeaderFallback: () => openSocket(), // BC unavailable
 * })
 * election.start()
 * // Later:
 * election.relayMessage(msg) // called by the leader after each WS message
 * election.destroy()
 * ```
 */

import type { WsPriceUpdate } from '../types'

// ── Protocol constants ───────────────────────────────────────────────────────

/** BroadcastChannel name shared across all tabs for this feature. */
const CHANNEL_NAME = 'supo:ws-leader'

/** How often the leader broadcasts a heartbeat (ms). */
const HEARTBEAT_INTERVAL_MS = 2_000

/**
 * How long a follower waits after the last heartbeat before declaring the
 * leader dead and starting a new election.
 */
const LEADER_TIMEOUT_MS = 6_000

/**
 * How long a tab waits after broadcasting CLAIM before assuming it won (i.e.
 * no competing tab ACKed within this window).
 */
const CLAIM_TIMEOUT_MS = 200

// ── Message types ────────────────────────────────────────────────────────────

type ElectionMsgType =
  | 'CLAIM'     // "I want to become leader"
  | 'ACK'       // "I am already leader — you are a follower"
  | 'HEARTBEAT' // "I am still alive"
  | 'RELAY'     // "Forwarding a WS price_update to followers"
  | 'RESIGN'    // "I am unloading — you should elect a new leader"

interface ElectionMsg {
  type: ElectionMsgType
  tabId: string
  /** Present only on RELAY messages. */
  payload?: WsPriceUpdate
}

// ── Callbacks ────────────────────────────────────────────────────────────────

export interface WsLeaderElectionCallbacks {
  /**
   * Called when this tab wins the election and must open a real WebSocket.
   */
  onBecomeLeader: () => void
  /**
   * Called when this tab learns it is a follower (another tab is leader).
   * The caller should close / not open its own WebSocket.
   */
  onBecomeFollower: () => void
  /**
   * Called on each relayed `price_update` message received from the leader.
   * Followers use this to update their live price state without their own WS.
   */
  onFollowerMessage: (msg: WsPriceUpdate) => void
  /**
   * Called when BroadcastChannel is unavailable (unsupported browser or private
   * browsing restriction).  The caller should open its own WebSocket normally.
   */
  onLeaderFallback: () => void
}

// ── Election state machine ───────────────────────────────────────────────────

type ElectionState =
  | 'idle'
  | 'claiming'  // CLAIM sent; waiting for ACK or timeout
  | 'leader'
  | 'follower'
  | 'fallback'  // BroadcastChannel unavailable
  | 'destroyed'

/**
 * Leader election coordinator.  One instance per tab.
 */
export class WsLeaderElection {
  private readonly tabId: string
  private state: ElectionState = 'idle'
  private channel: BroadcastChannel | null = null
  private readonly callbacks: WsLeaderElectionCallbacks

  private claimTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private leaderTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(callbacks: WsLeaderElectionCallbacks) {
    this.callbacks = callbacks
    this.tabId =
      (typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('__supo_tab_id__')) ||
      crypto.randomUUID()

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('__supo_tab_id__', this.tabId)
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Start the election. Call once after constructing the instance.
   * If BroadcastChannel is unavailable the `onLeaderFallback` callback fires
   * immediately and this instance becomes a no-op thereafter.
   */
  start(): void {
    if (this.state !== 'idle') return

    if (typeof BroadcastChannel === 'undefined') {
      this.enterFallback()
      return
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME)
      this.channel.onmessage = (e: MessageEvent<ElectionMsg>) => this.handleMessage(e.data)
    } catch {
      this.enterFallback()
      return
    }

    this.sendClaim()
  }

  /**
   * Relay a WebSocket price_update message to followers.
   * Must only be called by the leader tab.
   */
  relayMessage(msg: WsPriceUpdate): void {
    if (this.state !== 'leader' || !this.channel) return
    this.post({ type: 'RELAY', tabId: this.tabId, payload: msg })
  }

  /** Whether this tab is currently operating as the WS leader. */
  get isLeader(): boolean {
    return this.state === 'leader'
  }

  /** Whether this tab is operating without BroadcastChannel (owns its own WS). */
  get isFallback(): boolean {
    return this.state === 'fallback'
  }

  /**
   * Clean up all resources.  Safe to call multiple times.
   */
  destroy(): void {
    if (this.state === 'destroyed') return

    if (this.state === 'leader') {
      this.post({ type: 'RESIGN', tabId: this.tabId })
    }

    this.clearAllTimers()

    if (this.channel) {
      this.channel.close()
      this.channel = null
    }

    this.state = 'destroyed'
  }

  // ── State transitions ───────────────────────────────────────────────────────

  private sendClaim(): void {
    this.state = 'claiming'
    this.post({ type: 'CLAIM', tabId: this.tabId })

    // If nobody ACKs within CLAIM_TIMEOUT_MS, assume we won the election.
    this.claimTimer = setTimeout(() => {
      this.claimTimer = null
      if (this.state === 'claiming') {
        this.enterLeader()
      }
    }, CLAIM_TIMEOUT_MS)
  }

  private enterLeader(): void {
    this.state = 'leader'
    this.clearClaimTimer()
    this.clearLeaderTimeoutTimer()

    // Broadcast heartbeats so followers know we're alive
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'leader') {
        this.post({ type: 'HEARTBEAT', tabId: this.tabId })
      }
    }, HEARTBEAT_INTERVAL_MS)

    this.callbacks.onBecomeLeader()
  }

  private enterFollower(): void {
    this.state = 'follower'
    this.clearClaimTimer()
    this.clearHeartbeatTimer()

    this.resetLeaderTimeout()
    this.callbacks.onBecomeFollower()
  }

  private enterFallback(): void {
    this.state = 'fallback'
    this.clearAllTimers()
    this.callbacks.onLeaderFallback()
  }

  // ── Message handling ────────────────────────────────────────────────────────

  private handleMessage(msg: ElectionMsg): void {
    // Ignore own messages (BroadcastChannel doesn't echo to sender, but guard anyway)
    if (msg.tabId === this.tabId) return

    switch (msg.type) {
      case 'CLAIM':
        // Another tab wants to become leader.  If we are already the leader, ACK
        // to tell it to stand down.
        if (this.state === 'leader') {
          this.post({ type: 'ACK', tabId: this.tabId })
        }
        break

      case 'ACK':
        // A leader ACKed our claim — we are a follower.
        if (this.state === 'claiming' || this.state === 'leader') {
          this.enterFollower()
        }
        break

      case 'HEARTBEAT':
        // Leader is alive; reset the death timer.
        if (this.state === 'follower') {
          this.resetLeaderTimeout()
        }
        break

      case 'RELAY':
        // Price update forwarded by the leader.
        if (this.state === 'follower' && msg.payload) {
          this.callbacks.onFollowerMessage(msg.payload)
          this.resetLeaderTimeout()
        }
        break

      case 'RESIGN':
        // Leader is unloading — start a new election.
        if (this.state === 'follower') {
          this.clearLeaderTimeoutTimer()
          this.sendClaim()
        }
        break
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private post(msg: ElectionMsg): void {
    try {
      this.channel?.postMessage(msg)
    } catch {
      // Swallow — channel may have been closed concurrently.
    }
  }

  private resetLeaderTimeout(): void {
    this.clearLeaderTimeoutTimer()
    this.leaderTimeoutTimer = setTimeout(() => {
      // Leader appears dead — start a new election.
      this.leaderTimeoutTimer = null
      if (this.state === 'follower') {
        this.sendClaim()
      }
    }, LEADER_TIMEOUT_MS)
  }

  private clearClaimTimer(): void {
    if (this.claimTimer) {
      clearTimeout(this.claimTimer)
      this.claimTimer = null
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearLeaderTimeoutTimer(): void {
    if (this.leaderTimeoutTimer) {
      clearTimeout(this.leaderTimeoutTimer)
      this.leaderTimeoutTimer = null
    }
  }

  private clearAllTimers(): void {
    this.clearClaimTimer()
    this.clearHeartbeatTimer()
    this.clearLeaderTimeoutTimer()
  }
}
