import { useEffect, useRef, memo } from 'react'
import type { PriceHistoryEntry } from '../types'

interface SparklineProps {
  history: PriceHistoryEntry[]
  /** Number of most-recent data points to display */
  points?: number
  width?: number
  height?: number
  className?: string
}

function buildPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const toX = (i: number) => (i / (values.length - 1)) * width
  const toY = (v: number) => height - ((v - min) / range) * height * 0.85 - height * 0.075

  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(2)},${toY(v).toFixed(2)}`)
    .join(' ')

  return d
}

function getTrend(values: number[]): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat'
  const first = values[0]
  const last = values[values.length - 1]
  const diff = (last - first) / (first || 1)
  if (diff > 0.001) return 'up'
  if (diff < -0.001) return 'down'
  return 'flat'
}

export const Sparkline = memo(function Sparkline({
  history,
  points = 24,
  width = 100,
  height = 32,
  className = '',
}: SparklineProps) {
  const pathRef = useRef<SVGPathElement>(null)

  const slice = history.slice(-points)
  const values = slice.map((e) => e.price)
  const trend = getTrend(values)
  const path = buildPath(values, width, height)

  const color =
    trend === 'up'
      ? '#22c55e'   // green-500
      : trend === 'down'
      ? '#ef4444'   // red-500
      : '#6b7280'   // gray-500

  const trendLabel =
    trend === 'up'
      ? 'upward trend'
      : trend === 'down'
      ? 'downward trend'
      : 'flat trend'

  // Animate the path drawing on first load
  useEffect(() => {
    const el = pathRef.current
    if (!el || !path) return
    const length = el.getTotalLength()
    // Start hidden
    el.style.strokeDasharray = `${length}`
    el.style.strokeDashoffset = `${length}`
    // Force reflow
    void el.getBoundingClientRect()
    // Animate
    el.style.transition = 'stroke-dashoffset 0.8s ease-in-out'
    el.style.strokeDashoffset = '0'
    return () => {
      el.style.transition = ''
    }
  }, [path])

  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-label="Insufficient data for sparkline"
        role="img"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#374151"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    )
  }

  const firstVal = values[0]
  const lastVal = values[values.length - 1]
  const changePct = (((lastVal - firstVal) / (firstVal || 1)) * 100).toFixed(2)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Price sparkline showing ${trendLabel} over last ${values.length} data points, change ${changePct}%`}
    >
      {/* Subtle gradient fill under line */}
      <defs>
        <linearGradient id={`sg-${trend}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      {path && (
        <path
          d={`${path} L${width},${height} L0,${height} Z`}
          fill={`url(#sg-${trend})`}
        />
      )}

      {/* The line itself */}
      {path && (
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* End dot */}
      {values.length >= 2 && (() => {
        const lastIdx = values.length - 1
        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min || 1
        const x = width
        const y = height - ((lastVal - min) / range) * height * 0.85 - height * 0.075
        return <circle cx={x} cy={y} r={2} fill={color} />
      })()}
    </svg>
  )
})
