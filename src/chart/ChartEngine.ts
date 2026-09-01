export interface ChartPoint {
  x: number
  y: number
  /** Optional metadata for tooltip rendering. */
  meta?: Record<string, unknown>
}

export type SeriesStyle = 'area' | 'line' | 'dashed-line'

export interface ChartSeries {
  id: string
  label: string
  points: ChartPoint[]
  color: string
  style: SeriesStyle
}

export interface Viewport {
  width: number
  height: number
  paddingX: number
  paddingY: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ChartPlugin {
  name: string
  render(ctx: CanvasRenderingContext2D, series: ChartSeries[], vp: Viewport): void
}

export function toCanvasX(vp: Viewport, x: number): number {
  const ratio = (x - vp.minX) / (vp.maxX - vp.minX || 1)
  return vp.paddingX + ratio * (vp.width - vp.paddingX * 2)
}

export function toCanvasY(vp: Viewport, y: number): number {
  const ratio = (y - vp.minY) / (vp.maxY - vp.minY || 1)
  return vp.height - vp.paddingY - ratio * (vp.height - vp.paddingY * 2)
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function createAreaPlugin(): ChartPlugin {
  return {
    name: 'area',
    render(ctx, series, vp) {
      for (const s of series) {
        if (s.style !== 'area' || s.points.length < 2) continue
        const pts = s.points.map((p) => ({ cx: toCanvasX(vp, p.x), cy: toCanvasY(vp, p.y) }))

        ctx.beginPath()
        ctx.moveTo(pts[0].cx, pts[0].cy)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].cx, pts[i].cy)
        ctx.lineTo(pts[pts.length - 1].cx, vp.height - vp.paddingY)
        ctx.lineTo(pts[0].cx, vp.height - vp.paddingY)
        ctx.closePath()
        const grad = ctx.createLinearGradient(0, vp.paddingY, 0, vp.height - vp.paddingY)
        grad.addColorStop(0, hexToRgba(s.color, 0.3))
        grad.addColorStop(1, hexToRgba(s.color, 0))
        ctx.fillStyle = grad
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(pts[0].cx, pts[0].cy)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].cx, pts[i].cy)
        ctx.strokeStyle = s.color
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.stroke()
      }
    },
  }
}

export function createLinePlugin(): ChartPlugin {
  return {
    name: 'line',
    render(ctx, series, vp) {
      for (const s of series) {
        if ((s.style !== 'line' && s.style !== 'dashed-line') || s.points.length < 2) continue
        const pts = s.points.map((p) => ({ cx: toCanvasX(vp, p.x), cy: toCanvasY(vp, p.y) }))

        ctx.beginPath()
        ctx.moveTo(pts[0].cx, pts[0].cy)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].cx, pts[i].cy)
        ctx.strokeStyle = s.color
        ctx.lineWidth = 1.5
        ctx.setLineDash(s.style === 'dashed-line' ? [5, 3] : [])
        ctx.stroke()
        ctx.setLineDash([])
      }
    },
  }
}

/**
 * Decimation threshold (#505): series with more points than this are
 * downsampled with LTTB before rendering.
 */
export const DECIMATION_THRESHOLD = 2000

/** Target point count series are decimated down to when above the threshold. */
export const DECIMATION_TARGET_POINTS = 1000

/**
 * Largest Triangle Three Buckets (LTTB) downsampling.
 *
 * Reduces `points` to `targetPoints` while preserving the visual shape of the
 * series (peaks/valleys survive, unlike naive stride sampling). Always keeps
 * the first and last point. No-op when `points.length <= targetPoints`.
 *
 * Reference: Sveinn Steinarsson, "Downsampling Time Series for Visual
 * Representation", Reykjavík University, 2013.
 */
export function lttbDecimate(points: ChartPoint[], targetPoints: number): ChartPoint[] {
  const n = points.length
  if (targetPoints < 3 || n <= targetPoints) return points

  const sampled: ChartPoint[] = [points[0]]
  const bucketSize = (n - 2) / (targetPoints - 2)
  let prevIdx = 0

  for (let i = 0; i < targetPoints - 2; i++) {
    const nextStart = Math.floor((i + 1) * bucketSize) + 1
    const nextEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n)

    let avgX = 0
    let avgY = 0
    const nextSize = Math.max(1, nextEnd - nextStart)
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += points[j].x
      avgY += points[j].y
    }
    avgX /= nextSize
    avgY /= nextSize

    const curStart = Math.floor(i * bucketSize) + 1
    const curEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n)

    const prev = points[prevIdx]
    let maxArea = -1
    let maxIdx = curStart

    for (let j = curStart; j < curEnd; j++) {
      const area = Math.abs(
        (prev.x - avgX) * (points[j].y - prev.y) - (prev.x - points[j].x) * (avgY - prev.y),
      ) * 0.5
      if (area > maxArea) {
        maxArea = area
        maxIdx = j
      }
    }

    sampled.push(points[maxIdx])
    prevIdx = maxIdx
  }

  sampled.push(points[n - 1])
  return sampled
}

export interface DecimationResult {
  series: ChartSeries[]
  /** True when any series in the output was decimated. */
  decimated: boolean
  /** Total source points across all series before decimation. */
  sourcePointCount: number
  /** Total rendered points across all series after decimation. */
  renderedPointCount: number
}

/**
 * Applies LTTB decimation to every series whose point count exceeds
 * {@link DECIMATION_THRESHOLD}, keeping series under the threshold untouched.
 * Used by chart renderers to stay smooth at 10k+ history points (#505).
 */
export function decimateSeries(
  series: ChartSeries[],
  threshold = DECIMATION_THRESHOLD,
  targetPoints = DECIMATION_TARGET_POINTS,
): DecimationResult {
  let decimated = false
  let sourcePointCount = 0
  let renderedPointCount = 0

  const out = series.map((s) => {
    sourcePointCount += s.points.length
    if (s.points.length <= threshold) {
      renderedPointCount += s.points.length
      return s
    }
    const points = lttbDecimate(s.points, targetPoints)
    decimated = true
    renderedPointCount += points.length
    return { ...s, points }
  })

  return { series: out, decimated, sourcePointCount, renderedPointCount }
}

export function computeViewport(
  series: ChartSeries[],
  width: number,
  height: number,
  paddingX = 0,
  paddingY = 8,
): Viewport {
  const allPoints = series.flatMap((s) => s.points)
  if (allPoints.length === 0) {
    return { width, height, paddingX, paddingY, minX: 0, maxX: 1, minY: 0, maxY: 1 }
  }
  const xs = allPoints.map((p) => p.x)
  const ys = allPoints.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const yPad = (maxY - minY) * 0.05 || 1
  return { width, height, paddingX, paddingY, minX, maxX, minY: minY - yPad, maxY: maxY + yPad }
}

/**
 * #461 – Renders excluded-source ticks as hollow grey circles.
 *
 * Each point in the series is drawn as an outlined circle (no fill) so it is
 * visually distinct from accepted values on the main area/line series.
 */
export function createScatterPlugin(radius = 4): ChartPlugin {
  return {
    name: 'scatter',
    render(ctx, series, vp) {
      for (const s of series) {
        for (const pt of s.points) {
          const cx = toCanvasX(vp, pt.x)
          const cy = toCanvasY(vp, pt.y)
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.strokeStyle = s.color
          ctx.lineWidth = 1.5
          ctx.setLineDash([])
          ctx.stroke()
          // hollow — no fill
        }
      }
    },
  }
}

/**
 * #463 – Renders anomaly marker triangles above flagged ticks.
 *
 * Points with `meta.severity === 'critical'` use red; others use amber.
 */
export function createAnomalyPlugin(markerSize = 6): ChartPlugin {
  return {
    name: 'anomaly',
    render(ctx, series, vp) {
      for (const s of series) {
        for (const pt of s.points) {
          const severity = (pt.meta?.severity as string | undefined) ?? 'warning'
          const color = severity === 'critical' ? '#ef4444' : '#f59e0b'
          const cx = toCanvasX(vp, pt.x)
          const cy = toCanvasY(vp, pt.y) - markerSize - 4

          // Downward-pointing triangle above the tick
          ctx.beginPath()
          ctx.moveTo(cx, cy + markerSize)
          ctx.lineTo(cx - markerSize / 2, cy)
          ctx.lineTo(cx + markerSize / 2, cy)
          ctx.closePath()
          ctx.fillStyle = color
          ctx.fill()
        }
      }
    },
  }
}
