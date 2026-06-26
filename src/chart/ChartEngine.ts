export interface ChartPoint {
  x: number
  y: number
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
