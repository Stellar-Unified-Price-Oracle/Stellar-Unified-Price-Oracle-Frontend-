import { useCallback, useRef, useEffect } from 'react'

/**
 * Priority levels for announcements
 * - `polite`: announcement waits for a pause in speech (default)
 * - `assertive`: interrupts current speech immediately
 */
export type AnnouncementPriority = 'polite' | 'assertive'

export interface Announcement {
  id: string
  message: string
  priority: AnnouncementPriority
  timestamp: number
}

interface AnnouncerConfig {
  maxHistorySize: number
  deduplicationMs: number
}

/**
 * Global announcement registry manages all screen reader announcements
 * across the application. Prevents duplicate/spam announcements using
 * configurable deduplication intervals.
 */
class AnnouncementRegistry {
  private history: Map<string, Announcement> = new Map()
  private listeners: Set<(announcement: Announcement) => void> = new Set()
  private deduplicationMap: Map<string, number> = new Map()
  private config: AnnouncerConfig

  constructor(config: Partial<AnnouncerConfig> = {}) {
    this.config = {
      maxHistorySize: 50,
      deduplicationMs: 1000,
      ...config,
    }
  }

  /**
   * Register a listener to be called whenever an announcement is made
   */
  subscribe(listener: (announcement: Announcement) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Announce a message to screen readers
   * Returns true if announced, false if deduplicated
   */
  announce(message: string, priority: AnnouncementPriority = 'polite'): boolean {
    const now = Date.now()
    const key = `${message}:${priority}`

    // Check deduplication window
    const lastTime = this.deduplicationMap.get(key)
    if (lastTime !== undefined && now - lastTime < this.config.deduplicationMs) {
      return false
    }

    const id = `announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const announcement: Announcement = {
      id,
      message,
      priority,
      timestamp: now,
    }

    // Update deduplication map
    this.deduplicationMap.set(key, now)

    // Add to history (with size limit)
    this.history.set(id, announcement)
    if (this.history.size > this.config.maxHistorySize) {
      const firstKey = this.history.keys().next().value
      this.history.delete(firstKey)
    }

    // Notify all listeners
    this.listeners.forEach(listener => listener(announcement))

    return true
  }

  /**
   * Clear all deduplication state (useful for testing or manual reset)
   */
  clearDeduplicationMap(): void {
    this.deduplicationMap.clear()
  }

  /**
   * Get all announcements in history
   */
  getHistory(): Announcement[] {
    return Array.from(this.history.values())
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AnnouncerConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Single global registry instance
let globalRegistry: AnnouncementRegistry | null = null

function getRegistry(): AnnouncementRegistry {
  if (!globalRegistry) {
    globalRegistry = new AnnouncementRegistry()
  }
  return globalRegistry
}

/**
 * Hook for announcing messages to screen readers via ARIA live regions.
 *
 * Uses global deduplication to prevent announcement spam. Configure
 * deduplication intervals based on your use case (e.g., price updates
 * might need shorter dedup windows than connection status).
 *
 * @example Basic announcement
 * ```tsx
 * const announce = useAnnounce()
 * announce('Price updated to $70,000')
 * ```
 *
 * @example Price update with rate limiting
 * ```tsx
 * const announce = useAnnounce({ deduplicationMs: 2000 })
 * if (pricChanged) {
 *   announce(`${pair} price is now $${price}`, 'polite')
 * }
 * ```
 *
 * @example Alert firing (immediate announcement)
 * ```tsx
 * const announce = useAnnounce()
 * announce('Price alert: BTC dropped 10% in 1 hour', 'assertive')
 * ```
 */
export function useAnnounce(config?: Partial<AnnouncerConfig>) {
  const registryRef = useRef(getRegistry())

  // Update config if provided
  useEffect(() => {
    if (config) {
      registryRef.current.setConfig(config)
    }
  }, [config])

  const announce = useCallback(
    (message: string, priority: AnnouncementPriority = 'polite'): boolean => {
      return registryRef.current.announce(message, priority)
    },
    [],
  )

  const subscribe = useCallback((listener: (announcement: Announcement) => void) => {
    return registryRef.current.subscribe(listener)
  }, [])

  const getHistory = useCallback(() => {
    return registryRef.current.getHistory()
  }, [])

  return {
    announce,
    subscribe,
    getHistory,
  }
}

/**
 * Export registry for testing or global access
 */
export function getAnnouncementRegistry(): AnnouncementRegistry {
  return getRegistry()
}

/**
 * Reset registry for testing
 */
export function resetAnnouncementRegistry(): void {
  globalRegistry?.clearDeduplicationMap()
}
