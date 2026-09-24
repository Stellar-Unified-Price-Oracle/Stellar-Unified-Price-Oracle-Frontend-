/**
 * Cross-tab synchronization using the Broadcast Channel API.
 * Allows state changes in one tab to sync to all other tabs.
 *
 * @example
 * ```tsx
 * const channel = createBroadcastChannel('preferences')
 * channel.subscribe(message => {
 *   if (message.type === 'update') {
 *     setPreferences(message.payload)
 *   }
 * })
 *
 * // Broadcast changes to other tabs
 * channel.broadcast('update', newPreferences)
 * ```
 */

/**
 * Message types that can be broadcast across tabs
 */
export type BroadcastMessageType =
  | 'preferences-update'
  | 'alerts-update'
  | 'alerts-history-update'
  | 'watchlists-update'

export interface BroadcastMessage<T = unknown> {
  type: BroadcastMessageType
  payload: T
  timestamp: number
  tabId: string
}

/**
 * Creates a broadcast channel for cross-tab communication.
 * Gracefully handles browsers without Broadcast Channel API support.
 */
export function createBroadcastChannel<T = unknown>(channelName: string) {
  // Generate unique tab ID for this session
  const tabId = sessionStorage.getItem(`__kiro_tab_id_${channelName}`)
    || crypto.randomUUID()

  if (!sessionStorage.getItem(`__kiro_tab_id_${channelName}`)) {
    sessionStorage.setItem(`__kiro_tab_id_${channelName}`, tabId)
  }

  let channel: BroadcastChannel | null = null
  const subscribers = new Set<(msg: BroadcastMessage<T>) => void>()
  const isSupported = typeof BroadcastChannel !== 'undefined'

  if (isSupported) {
    try {
      channel = new BroadcastChannel(channelName)
      channel.onmessage = (event) => {
        const msg = event.data as BroadcastMessage<T>
        // Only notify if message is from another tab
        if (msg.tabId !== tabId) {
          subscribers.forEach((sub) => sub(msg))
        }
      }
    } catch (err) {
      console.warn(`[BroadcastChannel] Failed to create channel "${channelName}":`, err)
    }
  }

  return {
    /**
     * Subscribe to messages on this channel.
     * @returns Unsubscribe function
     */
    subscribe(callback: (msg: BroadcastMessage<T>) => void): () => void {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },

    /**
     * Broadcast a message to all other tabs.
     */
    broadcast(type: BroadcastMessageType, payload: T): void {
      const msg: BroadcastMessage<T> = {
        type,
        payload,
        timestamp: Date.now(),
        tabId,
      }

      if (channel) {
        try {
          channel.postMessage(msg)
        } catch (err) {
          console.warn(`[BroadcastChannel] Failed to post message:`, err)
        }
      }
    },

    /**
     * Get the unique ID of this tab
     */
    getTabId(): string {
      return tabId
    },

    /**
     * Check if Broadcast Channel API is supported
     */
    isSupported(): boolean {
      return isSupported && channel !== null
    },

    /**
     * Clean up resources
     */
    close(): void {
      if (channel) {
        channel.close()
        channel = null
      }
    },
  }
}
