/**
 * ChartToolbar — toggle buttons for SMA, EMA, and RSI technical indicators.
 *
 * Persists indicator configuration to localStorage under 'supo:chart-indicators'
 * and restores it on mount.
 */

import { useEffect } from 'react'
import type { IndicatorConfig, IndicatorType } from '../workers/types'

interface ChartToolbarProps {
  indicators: IndicatorConfig[]
  onIndicatorsChange: (indicators: IndicatorConfig[]) => void
}

const STORAGE_KEY = 'supo:chart-indicators'

const DEFAULTS: Record<IndicatorType, Omit<IndicatorConfig, 'enabled'>> = {
  sma: { type: 'sma', period: 20 },
  ema: { type: 'ema', period: 20 },
  rsi: { type: 'rsi', period: 14 },
}

const LABEL: Record<IndicatorType, string> = {
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
}

const ACTIVE_COLOR: Record<IndicatorType, string> = {
  sma: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
  ema: 'bg-orange-500/20 text-orange-300 border-orange-500',
  rsi: 'bg-purple-500/20 text-purple-300 border-purple-500',
}

const INDICATOR_TYPES: IndicatorType[] = ['sma', 'ema', 'rsi']

function loadFromStorage(): IndicatorConfig[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed as IndicatorConfig[]
  } catch {
    return null
  }
}

function saveToStorage(indicators: IndicatorConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(indicators))
  } catch {
    // Storage unavailable — proceed silently
  }
}

export function ChartToolbar({ indicators, onIndicatorsChange }: ChartToolbarProps) {
  // Load persisted state on mount and propagate upward
  useEffect(() => {
    const saved = loadFromStorage()
    if (saved && saved.length > 0) {
      onIndicatorsChange(saved)
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getConfig(type: IndicatorType): IndicatorConfig | undefined {
    return indicators.find((c) => c.type === type)
  }

  function handleToggle(type: IndicatorType) {
    const existing = getConfig(type)
    let next: IndicatorConfig[]

    if (!existing) {
      // First activation — add with defaults
      next = [...indicators, { ...DEFAULTS[type], enabled: true }]
    } else if (existing.enabled) {
      // Turn off
      next = indicators.map((c) => (c.type === type ? { ...c, enabled: false } : c))
    } else {
      // Re-enable
      next = indicators.map((c) => (c.type === type ? { ...c, enabled: true } : c))
    }

    saveToStorage(next)
    onIndicatorsChange(next)
  }

  function handlePeriodChange(type: IndicatorType, value: number) {
    const clamped = Math.max(2, Math.min(200, value))
    const existing = getConfig(type)
    let next: IndicatorConfig[]

    if (!existing) {
      next = [...indicators, { ...DEFAULTS[type], period: clamped, enabled: true }]
    } else {
      next = indicators.map((c) => (c.type === type ? { ...c, period: clamped } : c))
    }

    saveToStorage(next)
    onIndicatorsChange(next)
  }

  return (
    <div
      className='flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2'
      role='toolbar'
      aria-label='Technical indicators'
    >
      <span className='text-xs font-medium uppercase tracking-wider text-slate-400'>
        Indicators
      </span>

      {INDICATOR_TYPES.map((type) => {
        const cfg = getConfig(type)
        const active = cfg?.enabled ?? false

        return (
          <div key={type} className='flex items-center gap-1.5'>
            <button
              type='button'
              aria-label={`Toggle ${LABEL[type]} indicator`}
              aria-pressed={active}
              onClick={() => handleToggle(type)}
              className={[
                'rounded border px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                active
                  ? ACTIVE_COLOR[type]
                  : 'border-slate-600 bg-slate-700/40 text-slate-400 hover:border-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {LABEL[type]}
            </button>

            {active && (
              <div className='flex items-center gap-1'>
                <label
                  htmlFor={`indicator-period-${type}`}
                  className='sr-only'
                >
                  {LABEL[type]} period
                </label>
                <input
                  id={`indicator-period-${type}`}
                  type='number'
                  min={2}
                  max={200}
                  value={cfg?.period ?? DEFAULTS[type].period}
                  onChange={(e) => handlePeriodChange(type, e.target.valueAsNumber)}
                  aria-label={`${LABEL[type]} period`}
                  className='w-14 rounded border border-slate-600 bg-slate-700 px-1.5 py-0.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500'
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
