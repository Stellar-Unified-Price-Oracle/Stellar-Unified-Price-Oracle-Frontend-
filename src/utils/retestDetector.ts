/**
 * @file Price-level retest detection (#491).
 *
 * A threshold that is breached, exited, then re-entered is often more significant
 * than the initial breach — users want "notify me if it retests the level after
 * the first break". This module implements that detection as a small, fully
 * deterministic state machine driven only by whether the alert's condition is
 * currently true (`inZone`) and the price at that tick.
 *
 * ## State machine
 * ```
 *              (condition true)        (condition false)        (condition true)
 *   idle ─────────────────────────▶ inBreach ──────────────────▶ exited ──▶ inBreach
 *        emits `breach`            emits `exit`                 emits `retest`
 * ```
 *
 * - `breach`  — the condition just became true (first entry into the zone).
 * - `exit`    — the condition just became false (leaves the breached zone).
 * - `retest`  — the condition became true again after an exit (re-entry).
 *
 * It is pure and side-effect free, so it can be unit-tested exhaustively and
 * reused verbatim by the live alert engine and any simulation.
 */

/** Phase of the retest machine for one alert's threshold. */
export type RetestPhase = 'idle' | 'inBreach' | 'exited'

/** Runtime state persisted on the alert between evaluation ticks. */
export interface RetestState {
  phase: RetestPhase
  /** Monotonic count of completed breach cycles (breach→exit), used for history. */
  cycles: number
  /** Price at the most recent meaningful transition (breach/exit/retest). */
  lastEventPrice: number
  /** Unix ms of the most recent event. */
  lastEventAt: number
}

export const initialRetestState = (now: number): RetestState => ({
  phase: 'idle',
  cycles: 0,
  lastEventPrice: 0,
  lastEventAt: now,
})

/** A single detected retest event for a given tick. */
export interface RetestEvent {
  kind: 'breach' | 'exit' | 'retest'
  /** Price when the event was detected. */
  price: number
  /** Unix ms when the event was detected. */
  timestamp: number
  /** Which breach cycle this event belongs to (increments on each `exit`). */
  cycle: number
}

/**
 * Advances the retest machine by one evaluation tick. Returns the new state and,
 * on a transition, the event emitted — otherwise `null`.
 *
 * Deterministic: identical `(state, inZone, price, now)` always yields identical
 * output, which is what makes the sequence unit-testable.
 */
export function stepRetest(
  state: RetestState,
  inZone: boolean,
  price: number,
  now: number,
): { state: RetestState; event: RetestEvent | null } {
  const baseEvent = { price, timestamp: now }

  switch (state.phase) {
    case 'idle':
      if (inZone) {
        return {
          state: { ...state, phase: 'inBreach', lastEventPrice: price, lastEventAt: now },
          event: { ...baseEvent, kind: 'breach', cycle: state.cycles + 1 },
        }
      }
      return { state, event: null }

    case 'inBreach':
      if (inZone) {
        // Still inside the zone — no new event, price reference just follows.
        return { state: { ...state, lastEventPrice: price, lastEventAt: now }, event: null }
      }
      // Left the breached zone.
      return {
        state: { ...state, phase: 'exited', cycles: state.cycles + 1, lastEventPrice: price, lastEventAt: now },
        event: { ...baseEvent, kind: 'exit', cycle: state.cycles + 1 },
      }

    case 'exited':
      if (inZone) {
        // Re-entry after an exit — the retest event.
        return {
          state: { ...state, phase: 'inBreach', lastEventPrice: price, lastEventAt: now },
          event: { ...baseEvent, kind: 'retest', cycle: state.cycles },
        }
      }
      // Stayed out of the zone.
      return { state, event: null }
  }
}