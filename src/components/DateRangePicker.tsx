import { useCallback, useState, useId } from 'react'

export type PresetRange = '1h' | '24h' | '7d' | '30d' | '1y' | 'all'

export interface DateRange {
  preset: PresetRange | 'custom'
  startDate: string // ISO date string yyyy-MM-dd or ''
  endDate: string
}

const PRESETS: { label: string; value: PresetRange }[] = [
  { label: '1H', value: '1h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
]

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  maxRangeDays?: number
}

export function DateRangePicker({ value, onChange, maxRangeDays = 365 }: DateRangePickerProps) {
  const startId = useId()
  const endId = useId()
  const [customError, setCustomError] = useState<string | null>(null)

  const handlePreset = useCallback(
    (preset: PresetRange) => {
      setCustomError(null)
      onChange({ preset, startDate: '', endDate: '' })
    },
    [onChange],
  )

  const handleCustomChange = useCallback(
    (field: 'startDate' | 'endDate', val: string) => {
      const next: DateRange = { ...value, preset: 'custom', [field]: val }

      // Validation
      if (next.startDate && next.endDate) {
        const start = new Date(next.startDate)
        const end = new Date(next.endDate)
        if (end <= start) {
          setCustomError('End date must be after start date')
        } else {
          const diffDays = (end.getTime() - start.getTime()) / 86_400_000
          if (diffDays > maxRangeDays) {
            setCustomError(`Maximum range is ${maxRangeDays} days`)
          } else {
            setCustomError(null)
            onChange(next)
            return
          }
        }
      } else {
        setCustomError(null)
      }
      onChange(next)
    },
    [value, onChange, maxRangeDays],
  )

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Preset buttons */}
      <div
        role="group"
        aria-label="Time range presets"
        className="flex items-center gap-1 bg-gray-800 rounded-lg p-1"
      >
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePreset(p.value)}
            aria-pressed={value.preset === p.value}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              value.preset === p.value
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <label htmlFor={startId} className="sr-only">
            Start date
          </label>
          <input
            id={startId}
            type="date"
            value={value.startDate}
            max={value.endDate || today}
            onChange={(e) => handleCustomChange('startDate', e.target.value)}
            aria-invalid={!!customError}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 [color-scheme:dark]"
          />
        </div>
        <span className="text-gray-500 text-xs">to</span>
        <div className="flex flex-col">
          <label htmlFor={endId} className="sr-only">
            End date
          </label>
          <input
            id={endId}
            type="date"
            value={value.endDate}
            min={value.startDate || undefined}
            max={today}
            onChange={(e) => handleCustomChange('endDate', e.target.value)}
            aria-invalid={!!customError}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 [color-scheme:dark]"
          />
        </div>
      </div>

      {customError && (
        <p role="alert" className="text-xs text-red-400 w-full mt-1">
          {customError}
        </p>
      )}
    </div>
  )
}

/** Convert a DateRange to the API `limit` param and optional start/end timestamps */
export function dateRangeToParams(range: DateRange): { limit: number; startTs?: number; endTs?: number } {
  const now = Date.now()
  const HOUR = 3_600_000

  if (range.preset === 'custom' && range.startDate && range.endDate) {
    return {
      limit: 500,
      startTs: new Date(range.startDate).getTime(),
      endTs: new Date(range.endDate + 'T23:59:59').getTime(),
    }
  }

  switch (range.preset) {
    case '1h':
      return { limit: 60, startTs: now - HOUR }
    case '24h':
      return { limit: 288, startTs: now - 24 * HOUR }
    case '7d':
      return { limit: 500, startTs: now - 7 * 24 * HOUR }
    case '30d':
      return { limit: 500, startTs: now - 30 * 24 * HOUR }
    case '1y':
      return { limit: 500, startTs: now - 365 * 24 * HOUR }
    case 'all':
    default:
      return { limit: 500 }
  }
}
