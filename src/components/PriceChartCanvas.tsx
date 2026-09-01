/**
 * PriceChartCanvas — canvas-based price chart with optional technical
 * indicator overlays (SMA, EMA, RSI).
 *
 * - Price line: cyan  (#22d3ee)
 * - SMA line:   yellow (#facc15)
 * - EMA line:   orange (#fb923c)
 * - RSI panel:  purple (#a78bfa), occupies bottom 20% of canvas
 *
 * RSI is rendered in a separate sub-panel separated by a divider line.
 * All other indicators are overlaid on the main price panel.
 */

import { memo, useEffect, useRef } from 'react'
import type { IndicatorSeries } from '../workers/types'

interface PriceChartCanvasProps {
  history: { timestamp: number; price: number }[]
  indicatorSeries?: IndicatorSeries[]
  width?: number
  height?: number
  exportMode?: boolean
}

const INDICATOR_COLOR: Record<string, string> = {
  sma: '#facc15',
  ema: '#fb923c',
  rsi: '#a78bfa',
}

const RSI_PANEL_RATIO = 0.2  // bottom 20% for RSI
const PADDING = { top: 20, right: 16, bottom: 24, left: 52 }
const RSI_DIVIDER_H = 24     // height of the divider strip between panels

function mapX(index: number, total: number, left: number, right: number): number {
  if (total <= 1) return left
  return left + (index / (total - 1)) * (right - left)
}

function mapY(value: number, min: number, max: number, top: number, bottom: number): number {
  if (max === min) return (top + bottom) / 2
  return bottom - ((value - min) / (max - min)) * (bottom - top)
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  values: (number | null)[],
  color: string,
  lineWidth: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  minVal: number,
  maxVal: number,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.beginPath()
  let started = false
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null) {
      started = false
      continue
    }
    const x = mapX(i, values.length, left, right)
    const y = mapY(v, minVal, maxVal, top, bottom)
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
  ctx.restore()
}

function drawChart(
  canvas: HTMLCanvasElement,
  history: { timestamp: number; price: number }[],
  indicatorSeries: IndicatorSeries[],
  exportMode: boolean,
) {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  ctx.clearRect(0, 0, width, height)

  const hasRsi = indicatorSeries.some((s) => s.type === 'rsi')

  // Compute panel boundaries (in CSS pixels × dpr already applied via canvas size)
  const rsiPanelH = hasRsi ? Math.floor(height * RSI_PANEL_RATIO) : 0
  const dividerH = hasRsi ? RSI_DIVIDER_H : 0

  const priceTop = PADDING.top
  const priceBottom = height - PADDING.bottom - rsiPanelH - dividerH
  const rsiTop = priceBottom + dividerH
  const rsiBottom = height - PADDING.bottom
  const left = PADDING.left
  const right = width - PADDING.right

  if (history.length < 2) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${13 * dpr}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('Not enough data', width / 2, height / 2)
    return
  }

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)

  // ── Grid lines ────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  const gridRows = 4
  for (let r = 0; r <= gridRows; r++) {
    const y = priceTop + (r / gridRows) * (priceBottom - priceTop)
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }

  // ── Price min/max ─────────────────────────────────────────────────────────
  const prices = history.map((h) => h.price)
  const priceMin = Math.min(...prices)
  const priceMax = Math.max(...prices)

  // ── Price line (cyan) ─────────────────────────────────────────────────────
  ctx.save()
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  history.forEach((h, i) => {
    const x = mapX(i, history.length, left, right)
    const y = mapY(h.price, priceMin, priceMax, priceTop, priceBottom)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.restore()

  // ── Overlay indicators (SMA, EMA) on price panel ──────────────────────────
  for (const series of indicatorSeries) {
    if (series.type === 'rsi') continue
    drawLine(
      ctx,
      series.values,
      INDICATOR_COLOR[series.type],
      1.5,
      left, right, priceTop, priceBottom,
      priceMin, priceMax,
    )
  }

  // ── Y-axis labels (price) ─────────────────────────────────────────────────
  const fontSize = Math.round(10 * dpr)
  ctx.fillStyle = '#64748b'
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'right'
  for (let r = 0; r <= gridRows; r++) {
    const val = priceMin + ((gridRows - r) / gridRows) * (priceMax - priceMin)
    const y = priceTop + (r / gridRows) * (priceBottom - priceTop)
    ctx.fillText(val.toFixed(4), left - 4, y + fontSize / 3)
  }

  // ── RSI sub-panel ─────────────────────────────────────────────────────────
  if (hasRsi) {
    // Divider line
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, priceBottom + dividerH / 2)
    ctx.lineTo(right, priceBottom + dividerH / 2)
    ctx.stroke()

    // RSI label
    ctx.fillStyle = '#64748b'
    ctx.font = `${Math.round(9 * dpr)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('RSI', left, rsiTop + 10)

    // 70 / 30 reference lines
    ctx.strokeStyle = '#374151'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    for (const level of [70, 50, 30]) {
      const y = mapY(level, 0, 100, rsiTop, rsiBottom)
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
      ctx.fillStyle = '#4b5563'
      ctx.textAlign = 'right'
      ctx.fillText(String(level), left - 4, y + 4)
    }
    ctx.setLineDash([])

    for (const series of indicatorSeries) {
      if (series.type !== 'rsi') continue
      drawLine(
        ctx,
        series.values,
        INDICATOR_COLOR.rsi,
        1.5,
        left, right, rsiTop, rsiBottom,
        0, 100,
      )
    }
  }

  // ── Legend (top-right) ────────────────────────────────────────────────────
  const legendSeries = [
    { label: 'Price', color: '#22d3ee' },
    ...indicatorSeries.map((s) => ({
      label: `${s.type.toUpperCase()}(${s.period})`,
      color: INDICATOR_COLOR[s.type],
    })),
  ]

  const legendFontSize = Math.round(9 * dpr)
  ctx.font = `${legendFontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'right'
  let legendY = priceTop + legendFontSize + 4
  for (const item of legendSeries) {
    ctx.fillStyle = item.color
    ctx.fillText(item.label, right, legendY)
    legendY += legendFontSize + 4
  }

  // ── Export watermark ──────────────────────────────────────────────────────
  if (exportMode) {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#94a3b8'
    ctx.font = `bold ${Math.round(11 * dpr)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('Stellar Oracle', left + 2, priceTop + 14)
    ctx.restore()
  }
}

export const PriceChartCanvas = memo(function PriceChartCanvas({
  history,
  indicatorSeries = [],
  width,
  height,
  exportMode = false,
}: PriceChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track resolved canvas dimensions
  const dimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    drawChart(canvas, history, indicatorSeries, exportMode)
  }

  // Set up ResizeObserver when explicit dimensions are not provided
  useEffect(() => {
    if (width !== undefined && height !== undefined) return

    const container = containerRef.current
    if (!container) return

    const dpr = window.devicePixelRatio || 1
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      const canvas = canvasRef.current
      if (!canvas) return
      // Avoid re-draw thrash when size hasn't changed
      if (dimsRef.current.w === w && dimsRef.current.h === h) return
      dimsRef.current = { w, h }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      redraw()
    })

    observer.observe(container)
    return () => observer.disconnect()
    // redraw is stable per render; intentionally omit to keep effect minimal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // Sync explicit width/height props to canvas
  useEffect(() => {
    if (width === undefined || height === undefined) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }, [width, height])

  // Redraw whenever data or options change
  useEffect(() => {
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, indicatorSeries, exportMode, width, height])

  if (width !== undefined && height !== undefined) {
    return (
      <canvas
        ref={canvasRef}
        aria-label='Price chart'
        role='img'
        className='block'
      />
    )
  }

  return (
    <div ref={containerRef} className='h-full w-full'>
      <canvas
        ref={canvasRef}
        aria-label='Price chart'
        role='img'
        className='block'
      />
    </div>
  )
})
