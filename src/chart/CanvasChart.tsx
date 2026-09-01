import { useCallback, useEffect, useRef, useState } from 'react'
import {
  computeViewport,
  createAreaPlugin,
  createLinePlugin,
  toCanvasX,
  toCanvasY,
} from './ChartEngine'
import type { ChartPlugin, ChartSeries } from './ChartEngine'

const DEFAULT_PLUGINS: ChartPlugin[] = [createAreaPlugin(), createLinePlugin()]

interface Crosshair {
  x: number
  y: number
  dataX: number
  dataY: number
  label: string
}

interface Props {
  series: ChartSeries[]
  plugins?: ChartPlugin[]
  className?: string
  formatX?: (x: number) => string
  formatY?: (y: number) => string
}

export function CanvasChart({ series, plugins = DEFAULT_PLUGINS, className = 'w-full h-48', formatX, formatY }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [crosshair, setCrosshair] = useState<Crosshair | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const vp = computeViewport(series, width, height, 0, 8)

    for (const plugin of plugins) {
      ctx.save()
      plugin.render(ctx, series, vp)
      ctx.restore()
    }
  }, [series, plugins])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const dpr = window.devicePixelRatio || 1
      const { width, height } = entry.contentRect
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      draw()
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas || series.length === 0) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const dpr = window.devicePixelRatio || 1
      const vp = computeViewport(series, canvas.width / dpr, canvas.height / dpr, 0, 8)

      // Find the closest point across all series
      let best: { dist: number; cx: number; cy: number; dataX: number; dataY: number; label: string } | null = null
      for (const s of series) {
        for (const pt of s.points) {
          const cx = toCanvasX(vp, pt.x)
          const cy = toCanvasY(vp, pt.y)
          const dist = Math.abs(cx - mouseX)
          if (!best || dist < best.dist) {
            best = {
              dist,
              cx,
              cy,
              dataX: pt.x,
              dataY: pt.y,
              label: s.label,
            }
          }
        }
      }

      if (best && best.dist < 40) {
        setCrosshair({ x: best.cx, y: best.cy, dataX: best.dataX, dataY: best.dataY, label: best.label })
      } else {
        setCrosshair(null)
      }
    },
    [series],
  )

  const defaultFormatX = useCallback((x: number) => {
    const d = new Date(x)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }, [])

  const defaultFormatY = useCallback((y: number) => {
    if (y >= 1000) return y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (y >= 1) return y.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    return y.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
  }, [])

  const fmtX = formatX ?? defaultFormatX
  const fmtY = formatY ?? defaultFormatY

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: 'block' }}
        aria-hidden="true"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCrosshair(null)}
      />
      {crosshair && (
        <div
          className="absolute pointer-events-none z-10"
          style={{ left: crosshair.x, top: 0, height: '100%' }}
        >
          <div className="absolute inset-y-0 left-0 w-px bg-gray-500/50" />
          <div
            className="absolute w-2 h-2 rounded-full bg-cyan-400 border-2 border-gray-900 -translate-x-1/2 -translate-y-1/2"
            style={{ top: crosshair.y }}
          />
          <div
            className="absolute left-2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 whitespace-nowrap"
            style={{ top: crosshair.y }}
          >
            <div className="text-gray-400 text-[10px]">{fmtX(crosshair.dataX)}</div>
            <div className="font-mono font-medium">{fmtY(crosshair.dataY)}</div>
          </div>
        </div>
      )}
      {series.length > 1 && (
        <div className="absolute top-2 right-2 flex items-center gap-3">
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-1 text-xs">
              <span
                className="inline-block w-5 h-0"
                style={{
                  border: `1.5px ${s.style === 'dashed-line' ? 'dashed' : 'solid'} ${s.color}`,
                }}
              />
              <span style={{ color: s.color }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
