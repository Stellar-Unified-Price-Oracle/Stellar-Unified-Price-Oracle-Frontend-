/**
 * Cross-tab coordination for service worker updates (#832).
 *
 * Every open tab can see a waiting worker, so without coordination each tab
 * would show its own prompt and could race to activate it. Tabs announce when
 * they start applying an update and when they dismiss the prompt. Peers then
 * disable their own prompt and hide it, instead of acting on the same update.
 *
 * Messages are advisory. A missed message only means a tab shows the prompt a
 * little longer. Every tab still reloads when the new worker takes control.
 */

const CHANNEL_NAME = 'supo-sw-update'

/** Identifies this tab, so a tab ignores its own broadcasts. */
const TAB_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random())

export type SwUpdateMessage =
  { type: 'applying'; sender: string } | { type: 'dismissed'; until: number; sender: string }

function isSwUpdateMessage(value: unknown): value is SwUpdateMessage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.sender !== 'string') return false
  if (candidate.type === 'applying') return true
  return candidate.type === 'dismissed' && typeof candidate.until === 'number' && Number.isFinite(candidate.until)
}

let sender: BroadcastChannel | null = null

function getSender(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!sender) {
    try {
      sender = new BroadcastChannel(CHANNEL_NAME)
    } catch {
      return null
    }
  }
  return sender
}

/** Tells every other tab on this origin about an update action. Best-effort. */
export function broadcastSwUpdate(message: { type: 'applying' } | { type: 'dismissed'; until: number }): void {
  try {
    getSender()?.postMessage({ ...message, sender: TAB_ID })
  } catch {
    // Coordination is best-effort; the update still applies in this tab.
  }
}

/**
 * Listens for update messages from other tabs. Returns a cleanup function.
 * Messages from this tab and messages of the wrong shape are ignored.
 */
export function subscribeToSwUpdates(listener: (message: SwUpdateMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  let channel: BroadcastChannel
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return () => {}
  }
  channel.onmessage = (event: MessageEvent) => {
    if (!isSwUpdateMessage(event.data) || event.data.sender === TAB_ID) return
    listener(event.data)
  }
  return () => channel.close()
}
