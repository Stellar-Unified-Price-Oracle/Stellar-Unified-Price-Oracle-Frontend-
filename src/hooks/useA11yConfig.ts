import { useCallback, useRef } from 'react'
import { getAnnouncementRegistry } from './useAnnounce'

/**
 * Global accessibility configuration for announcement frequency and thresholds.
 *
 * This allows users to tune how often announcements are made, preventing
 * screen reader spam while ensuring important updates are still conveyed.
 */
export interface A11yConfig {
  /**
   * Global deduplication window for all announcements (milliseconds)
   * @default 1000
   */
  announcementDeduplicationMs: number

  /**
   * Price update configuration
   */
  price: {
    /** Minimum price change % to announce @default 1 */
    minChangePercent: number
    /** Dedup window for price updates @default 5000 */
    deduplicationMs: number
    /** Max prices to announce per batch @default 3 */
    maxPerBatch: number
  }

  /**
   * Alert configuration
   */
  alert: {
    /** Dedup window for alert announcements @default 3000 */
    deduplicationMs: number
    /** Whether to announce snoozed alerts @default false */
    announceSnooze: boolean
  }

  /**
   * Chart configuration
   */
  chart: {
    /** Dedup window for chart updates @default 5000 */
    deduplicationMs: number
    /** Min price range change % to announce @default 1 */
    minRangeChangePercent: number
  }

  /**
   * Whether announcements are enabled globally @default true
   */
  enabled: boolean
}

/**
 * Default accessibility configuration
 */
export const DEFAULT_A11Y_CONFIG: A11yConfig = {
  announcementDeduplicationMs: 1000,
  price: {
    minChangePercent: 1,
    deduplicationMs: 5000,
    maxPerBatch: 3,
  },
  alert: {
    deduplicationMs: 3000,
    announceSnooze: false,
  },
  chart: {
    deduplicationMs: 5000,
    minRangeChangePercent: 1,
  },
  enabled: true,
}

/**
 * Low frequency accessibility mode - fewer announcements to avoid spam
 */
export const A11Y_LOW_FREQUENCY: A11yConfig = {
  announcementDeduplicationMs: 2000,
  price: {
    minChangePercent: 5, // Only announce 5%+ changes
    deduplicationMs: 15000, // Wait 15 seconds between price announcements
    maxPerBatch: 1, // Only announce most significant change
  },
  alert: {
    deduplicationMs: 10000,
    announceSnooze: false,
  },
  chart: {
    deduplicationMs: 10000,
    minRangeChangePercent: 5,
  },
  enabled: true,
}

/**
 * High frequency accessibility mode - all announcements
 */
export const A11Y_HIGH_FREQUENCY: A11yConfig = {
  announcementDeduplicationMs: 500,
  price: {
    minChangePercent: 0.1, // Announce any change 0.1%+
    deduplicationMs: 1000, // Only wait 1 second between announcements
    maxPerBatch: 10,
  },
  alert: {
    deduplicationMs: 1000,
    announceSnooze: true,
  },
  chart: {
    deduplicationMs: 1000,
    minRangeChangePercent: 0.1,
  },
  enabled: true,
}

/**
 * Accessibility mode where announcements are disabled
 */
export const A11Y_NO_ANNOUNCEMENTS: A11yConfig = {
  ...DEFAULT_A11Y_CONFIG,
  enabled: false,
}

// Global config state
let globalA11yConfig = { ...DEFAULT_A11Y_CONFIG }

/**
 * Get the current accessibility configuration
 */
export function getA11yConfig(): A11yConfig {
  return { ...globalA11yConfig }
}

/**
 * Set the global accessibility configuration
 *
 * @example
 * ```tsx
 * // Use low frequency mode
 * setA11yConfig(A11Y_LOW_FREQUENCY)
 *
 * // Custom configuration
 * setA11yConfig({
 *   ...DEFAULT_A11Y_CONFIG,
 *   price: {
 *     ...DEFAULT_A11Y_CONFIG.price,
 *     minChangePercent: 2,
 *   },
 * })
 * ```
 */
export function setA11yConfig(config: Partial<A11yConfig>): void {
  globalA11yConfig = { ...globalA11yConfig, ...config }

  // Update announcement registry's deduplication settings
  const registry = getAnnouncementRegistry()
  registry.setConfig({
    deduplicationMs: globalA11yConfig.announcementDeduplicationMs,
  })
}

/**
 * Hook for accessing and updating accessibility configuration.
 * Should be placed in a settings/preferences component.
 *
 * @example
 * ```tsx
 * function AccessibilitySettings() {
 *   const { config, setConfig, preset } = useA11yConfig()
 *
 *   return (
 *     <div>
 *       <label>
 *         <input
 *           type="radio"
 *           checked={preset === 'default'}
 *           onChange={() => setConfig(DEFAULT_A11Y_CONFIG)}
 *         />
 *         Default
 *       </label>
 *       <label>
 *         <input
 *           type="radio"
 *           checked={preset === 'low-frequency'}
 *           onChange={() => setConfig(A11Y_LOW_FREQUENCY)}
 *         />
 *         Low Frequency (fewer announcements)
 *       </label>
 *       <label>
 *         <input
 *           type="radio"
 *           checked={preset === 'high-frequency'}
 *           onChange={() => setConfig(A11Y_HIGH_FREQUENCY)}
 *         />
 *         High Frequency (all announcements)
 *       </label>
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={config.enabled}
 *           onChange={(e) => setConfig({ enabled: e.target.checked })}
 *         />
 *         Enable Announcements
 *       </label>
 *     </div>
 *   )
 * }
 * ```
 */
export function useA11yConfig() {
  const presetRef = useRef<'default' | 'low-frequency' | 'high-frequency' | 'custom'>('default')

  const config = getA11yConfig()

  const setConfig = useCallback((newConfig: Partial<A11yConfig>, preset?: string) => {
    setA11yConfig(newConfig)
    if (preset) {
      presetRef.current = preset as 'default' | 'low-frequency' | 'high-frequency' | 'custom'
    }
  }, [])

  const setPreset = useCallback((preset: 'default' | 'low-frequency' | 'high-frequency') => {
    switch (preset) {
      case 'default':
        setA11yConfig(DEFAULT_A11Y_CONFIG)
        break
      case 'low-frequency':
        setA11yConfig(A11Y_LOW_FREQUENCY)
        break
      case 'high-frequency':
        setA11yConfig(A11Y_HIGH_FREQUENCY)
        break
    }
    presetRef.current = preset
  }, [])

  return {
    config,
    setConfig,
    preset: presetRef.current,
    setPreset,
  }
}
