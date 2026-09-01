/**
 * @file AlertSimulationChart (#490)
 *
 * Renders the result of `simulateAlert` as a compact mini-chart whose line is the
 * replayed synthetic series, with a reference marker at every point where the
 * alert's condition evaluated true. Uses the same recharts primitives as
 * `PriceChart`.
 *
 * Intentionally read-only and stateless — it only ever receives the already-computed
 * simulation output and is shown inside `AlertModal` as a visual preview. It never
 * writes to alert state or history.
 */
import { memo, useMemo, type ReactElement } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPriceShort } from '../utils/format'
import type { SimulatedPoint } from '../utils/alertSimulation'

interface Props {
  points: SimulatedPoint[]
}

interface Row {
  idx: number
  price: number
}

// Manual tooltip prop shape (matches the MultiPairOverlayChart pattern rather than
// extending recharts' TooltipProps, which this recharts version types differently).
interface SimTooltipProps {
  active?: boolean
  payload?: Array<{ value?: number | string }>
  label?: string | number
}

function SimTooltip({ active, payload }: SimTooltipProps): ReactElement | null {
  if (!active || !payload || payload.length === 0) return null
  const row = payload.find((p) => typeof p.value === 'number')
  if (!row) return null
  const value = typeof row.value === 'number' ? row.value : 0
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs shadow-lg">
      <span className="text-white font-mono">${formatPriceShort(value)}</span>
    </div>
  )
}

export const AlertSimulationChart = memo(function AlertSimulationChart({ points }: Props): ReactElement {
  const rows = useMemo<Row[]>(() => points.map((p) => ({ idx: p.index, price: p.price })), [points])
  const fired = useMemo(() => points.filter((p) => p.fired), [points])

  return (
    <div>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="idx"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1f2937' }}
              tickLine={false}
              label={{ value: 'step', position: 'insideBottomRight', offset: -2, fill: '#6b7280', fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${formatPriceShort(v)}`}
              width={70}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<SimTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#22d3ee"
              strokeWidth={1.5}
              fill="url(#simGradient)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {/* Fire markers — one reference dot per simulated firing point. */}
            {fired.map((p) => (
              <ReferenceDot
                key={p.index}
                x={p.index}
                y={p.price}
                r={3}
                fill="#22d3ee"
                stroke="#e0f2fe"
                strokeWidth={1}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-blue-300 mt-1">
        {fired.length > 0
          ? `Simulated fire: alert triggers at ${fired.length} point${fired.length === 1 ? '' : 's'} in this replay.`
          : 'No simulated fire — the current settings would not trigger on this replay.'}
      </p>
    </div>
  )
})