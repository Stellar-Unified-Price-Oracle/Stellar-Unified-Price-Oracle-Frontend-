import { downloadFile } from './export'

function cloneSvgWithBackground(svg: SVGSVGElement, bgColor: string): { svgString: string; width: number; height: number } {
  const width = svg.clientWidth || Number(svg.getAttribute('width')) || 800
  const height = svg.clientHeight || Number(svg.getAttribute('height')) || 400

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('width', '100%')
  bgRect.setAttribute('height', '100%')
  bgRect.setAttribute('fill', bgColor)
  clone.insertBefore(bgRect, clone.firstChild)

  return { svgString: new XMLSerializer().serializeToString(clone), width, height }
}

/** Finds the chart's rendered SVG element inside a container, if present. */
function findChartSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg')
}

/** Exports the chart currently rendered inside `container` as an SVG file. Returns false if no chart SVG was found. */
export function exportChartAsSvg(container: HTMLElement, filename: string, bgColor: string): boolean {
  const svg = findChartSvg(container)
  if (!svg) return false
  const { svgString } = cloneSvgWithBackground(svg, bgColor)
  downloadFile(svgString, filename, 'image/svg+xml')
  return true
}

export interface RasterizedChart {
  /** `data:image/png;base64,...` URL, embeddable directly (e.g. in a PDF). */
  dataUrl: string
  width: number
  height: number
}

/** Rasterises the chart currently rendered inside `container` to a PNG data URL via an offscreen canvas. Returns null if no chart SVG was found. */
export async function rasterizeChartToDataUrl(container: HTMLElement, bgColor: string, scale = 2): Promise<RasterizedChart | null> {
  const svg = findChartSvg(container)
  if (!svg) return null

  const { svgString, width, height } = cloneSvgWithBackground(svg, bgColor)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to rasterize chart SVG'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)

    return { dataUrl: canvas.toDataURL('image/png'), width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Exports the chart currently rendered inside `container` as a PNG file, rasterised via an offscreen canvas. */
export async function exportChartAsPng(container: HTMLElement, filename: string, bgColor: string, scale = 2): Promise<boolean> {
  const rasterized = await rasterizeChartToDataUrl(container, bgColor, scale)
  if (!rasterized) return false

  const a = document.createElement('a')
  a.href = rasterized.dataUrl
  a.download = filename
  a.click()
  return true
}
